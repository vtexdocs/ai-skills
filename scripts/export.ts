import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { spawnSync } from "child_process";
import matter from "gray-matter";
import { join, dirname } from "path";

interface SkillFrontmatter {
  name: string;
  description: string;
  track: string;
  tags: string[];
  globs?: string[];
  version?: string;
  vtex_docs_verified?: string;
  metadata?: {
    track?: string;
    tags?: string[];
    globs?: string[];
    version?: string;
    purpose?: string;
    applies_to?: string[];
    excludes?: string[];
    decision_scope?: string[];
    vtex_docs_verified?: string;
  };
}

interface Skill {
  frontmatter: SkillFrontmatter;
  content: string;
  filePath: string;
}

interface Track {
  name: string;
  skills: Skill[];
}

interface PlatformExporter {
  name: string;
  outputDir: string;
  export(skills: Skill[], tracks: Track[]): Promise<void>;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeOutput(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✓ ${filePath}`);
}

function skillSlug(skill: Skill): string {
  return skill.frontmatter.name;
}

function normalizeDescription(desc: string): string {
  return desc.replace(/\s+/g, " ").trim();
}

function resolveField<T>(fm: SkillFrontmatter, field: string): T | undefined {
  const flat = (fm as any)[field];
  if (flat !== undefined && flat !== null) return flat as T;
  if (fm.metadata) return (fm.metadata as any)[field] as T | undefined;
  return undefined;
}

function discoverSkills(): Skill[] {
  const skills: Skill[] = [];
  const tracksDir = "tracks";

  try {
    const tracks = readdirSync(tracksDir);
    for (const track of tracks) {
      const skillsDir = join(tracksDir, track, "skills");
      try {
        if (!statSync(skillsDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const skillDirs = readdirSync(skillsDir);
      for (const skillDir of skillDirs) {
        const skillFile = join(skillsDir, skillDir, "skill.md");
        try {
          const content = readFileSync(skillFile, "utf-8");
          const { data, content: markdownContent } = matter(content);

          skills.push({
            frontmatter: data as SkillFrontmatter,
            content: markdownContent,
            filePath: skillFile,
          });
        } catch {
          // Skip if skill.md doesn't exist or can't be parsed
        }
      }
    }
  } catch {
    // tracks directory doesn't exist yet
  }

  return skills;
}

function organizeByTrack(skills: Skill[]): Track[] {
  const trackMap = new Map<string, Skill[]>();

  for (const skill of skills) {
    const trackName = resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track;
    if (!trackMap.has(trackName)) {
      trackMap.set(trackName, []);
    }
    trackMap.get(trackName)!.push(skill);
  }

  return Array.from(trackMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, skills]) => ({
      name,
      skills: skills.sort((a, b) =>
        skillSlug(a).localeCompare(skillSlug(b))
      ),
    }));
}

// ─── Cursor Rules (.mdc) Exporter ───────────────────────────────────────────

function buildCursorMdc(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
  const globs = resolveField<string[]>(skill.frontmatter, 'globs');
  const globsLine =
    globs && globs.length > 0 ? globs.map((g) => `"${g}"`).join(",") : "";
  return `---
description: "${desc}"
globs: ${globsLine}
alwaysApply: false
---

${skill.content.trim()}
`;
}

function buildCursorTrackMdc(track: Track): string {
  const descriptions = track.skills
    .map((s) => normalizeDescription(s.frontmatter.description))
    .join(" ");
  const trackDesc = `Composite skill for the ${track.name} track. ${descriptions}`;

  // Collect all unique globs from skills in this track
  const allGlobs = new Set<string>();
  for (const skill of track.skills) {
    const skillGlobs = resolveField<string[]>(skill.frontmatter, 'globs');
    if (skillGlobs) {
      for (const g of skillGlobs) {
        allGlobs.add(g);
      }
    }
  }
  const globsLine =
    allGlobs.size > 0
      ? Array.from(allGlobs)
          .map((g) => `"${g}"`)
          .join(",")
      : "";

  const body = track.skills
    .map((s) => s.content.trim())
    .join("\n\n---\n\n");

  return `---
description: "${trackDesc}"
globs: ${globsLine}
alwaysApply: false
---

${body}
`;
}

// ─── GitHub Copilot Exporter ────────────────────────────────────────────────

function buildCopilotTrackMd(track: Track): string {
  const sections = track.skills.map((skill) => {
    return skill.content.trim();
  });

  return `# ${formatTrackTitle(track.name)}

${sections.join("\n\n---\n\n")}
`;
}

function buildCopilotInstructions(tracks: Track[]): string {
  const sections = tracks.map((track) => {
    const skillContent = track.skills
      .map((s) => s.content.trim())
      .join("\n\n---\n\n");

    return `# ${formatTrackTitle(track.name)}

${skillContent}`;
  });

  return `# VTEX Development Skills

These instructions provide guidance for AI-assisted VTEX platform development.

${sections.join("\n\n---\n\n")}
`;
}

// ─── Claude Projects Exporter ───────────────────────────────────────────────

function buildClaudeSkillMd(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
   const trackTitle = formatTrackTitle(resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track);

  return `This skill provides guidance for AI agents working with VTEX ${trackTitle}. Apply these constraints and patterns when assisting developers with ${desc.toLowerCase().endsWith(".") ? desc.toLowerCase() : desc.toLowerCase() + "."}

${skill.content.trim()}
`;
}

function buildClaudeTrackMd(track: Track): string {
  const trackTitle = formatTrackTitle(track.name);

  const sections = track.skills.map((skill) => {
    const desc = normalizeDescription(skill.frontmatter.description);
    return `This skill provides guidance for AI agents working with VTEX ${trackTitle}. Apply these constraints and patterns when assisting developers with ${desc.toLowerCase().endsWith(".") ? desc.toLowerCase() : desc.toLowerCase() + "."}

${skill.content.trim()}`;
  });

  return `${sections.join("\n\n---\n\n")}
`;
}

// ─── AGENTS.md Exporter ─────────────────────────────────────────────────────

function buildAgentsMdTrack(track: Track): string {
  const trackTitle = formatTrackTitle(track.name);

  const skillSections = track.skills.map((skill) => {
    const desc = normalizeDescription(skill.frontmatter.description);
    return `## ${skill.frontmatter.name}

> ${desc}

${skill.content.trim()}`;
  });

  return `# AGENTS.md — ${trackTitle}

These instructions guide AI agents working on VTEX ${trackTitle} tasks.
Follow these patterns and constraints when assisting developers.

${skillSections.join("\n\n---\n\n")}
`;
}

function buildAgentsMdRoot(tracks: Track[]): string {
  const trackList = tracks
    .map((track) => {
      const trackTitle = formatTrackTitle(track.name);
      const skillList = track.skills
        .map(
          (s) =>
            `  - **${s.frontmatter.name}**: ${normalizeDescription(s.frontmatter.description)}`
        )
        .join("\n");
      return `## ${trackTitle}

See [\`${track.name}/AGENTS.md\`](./${track.name}/AGENTS.md) for detailed instructions.

${skillList}`;
    })
    .join("\n\n");

  return `# AGENTS.md — VTEX Development Skills

This repository contains AI agent skills for VTEX platform development.
Each track directory contains an AGENTS.md with detailed instructions.

${trackList}
`;
}

// ─── OpenCode SKILL.md Exporter ─────────────────────────────────────────────

function buildOpenCodeSkillMd(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
  const content = skill.content.trim().replace(/\/skill\.md\)/g, "/SKILL.md)");

  return `---
name: ${skill.frontmatter.name}
description: "${desc}"
---

${content}
`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTrackTitle(trackName: string): string {
  const titles: Record<string, string> = {
    faststore: "FastStore Implementation & Customization",
    payment: "Payment Connector Development",
    "vtex-io": "Custom VTEX IO Apps",
    marketplace: "Marketplace Integration",
    headless: "Headless Front-End Development",
  };
  return titles[trackName] || trackName;
}

// ─── Platform Exporters ─────────────────────────────────────────────────────

const exporters: Record<string, PlatformExporter> = {
  cursor: {
    name: "Cursor",
    outputDir: "exports/cursor",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const skill of skills) {
         const fileName = `${resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track}-${skillSlug(skill)}.mdc`;
        writeOutput(join(outDir, fileName), buildCursorMdc(skill));
      }

      for (const track of tracks) {
        const fileName = `${track.name}-all.mdc`;
        writeOutput(join(outDir, fileName), buildCursorTrackMdc(track));
      }
    },
  },
  copilot: {
    name: "GitHub Copilot",
    outputDir: "exports/copilot",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const track of tracks) {
        const fileName = `${track.name}.md`;
        writeOutput(join(outDir, fileName), buildCopilotTrackMd(track));
      }

      writeOutput(
        join(outDir, "copilot-instructions.md"),
        buildCopilotInstructions(tracks)
      );
    },
  },
  claude: {
    name: "Claude",
    outputDir: "exports/claude",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const skill of skills) {
         const fileName = `${resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track}-${skillSlug(skill)}.md`;
        writeOutput(join(outDir, fileName), buildClaudeSkillMd(skill));
      }

      for (const track of tracks) {
        const fileName = `${track.name}.md`;
        writeOutput(join(outDir, fileName), buildClaudeTrackMd(track));
      }
    },
  },
  "agents-md": {
    name: "AGENTS.md",
    outputDir: "exports/agents-md",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const track of tracks) {
        writeOutput(
          join(outDir, track.name, "AGENTS.md"),
          buildAgentsMdTrack(track)
        );
      }

      writeOutput(join(outDir, "AGENTS.md"), buildAgentsMdRoot(tracks));
    },
  },
  opencode: {
    name: "OpenCode",
    outputDir: "exports/opencode",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const skill of skills) {
        writeOutput(
          join(outDir, skillSlug(skill), "SKILL.md"),
          buildOpenCodeSkillMd(skill)
        );
      }
    },
  },
};

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  let platforms: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && i + 1 < args.length) {
      const platform = args[i + 1];
      if (platform === "all") {
        platforms = Object.keys(exporters);
      } else if (exporters[platform]) {
        platforms.push(platform);
      } else {
        console.error(`Unknown platform: ${platform}`);
        process.exit(1);
      }
      i++;
    }
  }

  // Default to all platforms if none specified
  if (platforms.length === 0) {
    platforms = Object.keys(exporters);
  }

  return platforms;
}

async function main(): Promise<void> {
  const platforms = parseArgs();
  const skills = discoverSkills();

  if (skills.length === 0) {
    console.log("No skills found. Skipping export.");
    process.exit(0);
  }

  console.log(`Found ${skills.length} skills.`);
  const tracks = organizeByTrack(skills);
  console.log(
    `Organized into ${tracks.length} tracks: ${tracks.map((t) => t.name).join(", ")}\n`
  );

  for (const platform of platforms) {
    const exporter = exporters[platform];
    if (exporter) {
      console.log(`Exporting to ${exporter.name}...`);
      await exporter.export(skills, tracks);
      console.log("");
    }
  }

  console.log("Export complete.");

  if (platforms.length === Object.keys(exporters).length) {
    console.log("\nGenerating banner...");
    const result = spawnSync("python3", ["scripts/generate_banner.py"], {
      stdio: "inherit",
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      console.warn("Banner generation failed (python3/cairosvg not available). Skipping.");
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
