---
name: faststore-overrides
description: How to override FastStore native sections and inner components using getOverriddenSection, and how to create brand-new custom sections. Use when customizing existing sections (Navbar, Alert, ProductDetails, etc.), replacing inner component slots (BuyButton, Icon, etc.), adding CSS classes to a section, or creating new sections that integrate with VTEX Headless CMS.
metadata:
  author: vtex
  version: "1.0"
---

# FastStore Section Overrides & Custom Sections

FastStore provides global sections with defaults that every store typically needs. You can customize them by overriding their inner components or styles, or create entirely new sections.

**Key rule:** Always use `getOverriddenSection` from `@faststore/core` when overriding a section. Never rewrite an entire native section from scratch if overriding is sufficient.

## Section Registry — `src/components/index.tsx`

This is the **single entry point** where FastStore discovers all custom and overridden sections. It must use a **default export** (not named exports).

```tsx
// src/components/index.tsx
import CustomIconsAlert from "./sections/CustomIconsAlert/CustomIconsAlert";
import AlertWithImage from "./sections/AlertWithImage/AlertWithImage";
import CustomProductDetails from "./sections/CustomProductDetails/CustomProductDetails";
import CustomNewsletter from "./sections/CustomNewsletter/CustomNewsletter";
import ContactForm from "./ContactForm/ContactForm";

const sections = {
  // New section — unique name, must also exist in cms/faststore/components/cms_component__customIconsAlert.jsonc
  CustomIconsAlert,

  // New section — alert with image instead of icon. must also exist in cms/faststore/components/cms_component__alertWithImage.jsonc
  AlertWithImage,

  // Override — key matches native section name, replacing it everywhere
  ProductDetails: CustomProductDetails,

  // New section — contact form backed by a third-party GraphQL mutation.  must also exist in cms/faststore/components/cms_component__contactForm.jsonc
  ContactForm,

  // New section — custom newsletter with analytics.  must also exist in cms/faststore/components/cms_component__customNewsLetter.jsonc
  CustomNewsletter,
};

export default sections;
```

- **Override a native section**: Use the exact native name as the key (e.g., `ProductDetails`). The custom component replaces it on all pages.
- **Add a new section**: Use a unique new name as the key (e.g., `ContactForm`). Also define a CMS schema in `cms/faststore/components/cms_component__<sectionName>.jsonc`.

## Pattern 1: Override with Custom CSS Class Only

Use when you only need to restyle a native section, not change its inner components.

```tsx
// src/components/sections/CustomIconsAlert/CustomIconsAlert.tsx
import { getOverriddenSection, AlertSection } from "@faststore/core";
import styles from "./custom-icons-alert.module.scss";

const CustomIconsAlert = getOverriddenSection({
  Section: AlertSection,
  className: styles.customIconsAlert, // Added to the section root element
  // No `components` key needed — only styling changes
});

export default CustomIconsAlert;
```

## Pattern 2: Override an Inner Component

Use when you need to replace a specific sub-component within a native section.

```tsx
// src/components/sections/CustomProductDetails/CustomProductDetails.tsx
import { getOverriddenSection, ProductDetailsSection } from "@faststore/core";
import { BuyButtonWithDetails } from "../../BuyButtonWithDetails/BuyButtonWithDetails";

const CustomProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    // Key must match the slot name in the native section
    BuyButton: {
      Component: BuyButtonWithDetails, // Replaces native BuyButton
    },
  },
});

export default CustomProductDetails;
```

## Pattern 3: Override with Dynamic Props (Memoized)

Use when the override depends on props from the CMS or parent. Memoize with `useMemo` to avoid creating a new component type on every render (which would unmount/remount the subtree).

```tsx
// src/components/sections/AlertWithImage/AlertWithImage.tsx
import { useMemo } from "react";
import { AlertSection, getOverriddenSection } from "@faststore/core";
import { Image_unstable as Image } from "@faststore/core/experimental";
import styles from "./alert-with-image.module.scss";

interface AlertWithImageProps extends Omit<
  React.ComponentProps<typeof AlertSection>,
  "icon"
> {
  src: string;
  alt: string;
}

export default function AlertWithImage(props: AlertWithImageProps) {
  const { src, alt, ...otherProps } = props;

  const OverriddenAlert = useMemo(
    () =>
      getOverriddenSection({
        Section: AlertSection,
        className: styles.alertWithImage,
        components: {
          Icon: {
            Component: () => (
              <Image src={props.src} alt={props.alt} width={24} height={24} />
            ),
          },
        },
      }),
    [], // Empty deps — override structure is static
  );

  return <OverriddenAlert {...otherProps} icon="" />;
}

// <project_root>/src/components/index.tsx
export default {
  AlertSection: AlertWithImage,
};
```

## `getOverriddenSection` API

```ts
getOverriddenSection({
  Section: NativeSection,       // Required — native section from @faststore/core
  className?: string,           // Optional — CSS class applied to section root
  components?: {                // Optional — map of slot overrides
    [SlotName: string]: {
      Component: React.ComponentType,  // Replacement component (mutually exclusive with props)
      props?: Record<string, any>,     // Additional props merged into the slot
    },
  },
})
// Returns: A React component with the same props as the native section
```

`Component` and `props` are mutually exclusive per slot.

## Creating Brand-New Sections

When no native section fits your needs, create a section from scratch.

### Workflow

Follow the **[Mandatory Workflow for New Custom Sections](./cms-schema-and-section-registration.md#mandatory-workflow-for-new-custom-sections)** in `cms-schema-and-section-registration.md` for the complete step-by-step process.

### `gql` usage restrictions

The `gql` tag from `@faststore/core/api` is **only** for:

- Third-party mutations/queries defined in `src/graphql/thirdParty/`
- Fragment extensions in `src/fragments/`

**Do NOT** use `gql` inside custom section components for standalone queries against the built-in `search`, `product`, or `collection` root queries. This breaks the FastStore CLI GraphQL optimization step. Instead, read data from page context hooks (`usePage()`, `usePLP()`, `usePDP()`).

### Handling client-side data loading

Custom sections on PLP/Search pages that depend on client-side data (facets, full product details) must handle the loading state gracefully:

```tsx
export default function MySection() {
  const context = usePage<PLPContext | SearchPageContext>();
  const clientData = (context as any)?.data?.search?.facets;

  // Client data not yet available — render nothing or a skeleton
  if (!clientData) return null;

  return <section>...</section>;
}
```

This is expected behavior: the section renders once with server-only data (no facets), then re-renders after `useProductGalleryQuery` completes and the `PageProvider` context updates with the merged data.

### Example: ContactForm Section

```tsx
// src/components/ContactForm/ContactForm.tsx
import { useCallback, useState } from "react";
import { gql } from "@faststore/core/api";
import { useLazyQuery_unstable as useLazyQuery } from "@faststore/core/experimental";
import {
  Button as UIButton,
  InputField as UIInputField,
  Textarea as UITextArea,
} from "@faststore/ui";
import styles from "./contact-form.module.scss";

// gql tag must be at module scope — FastStore's build pipeline statically extracts it
export const mutation = gql(`
  mutation SubmitContactForm($data: ContactFormInput!) {
    submitContactForm(input: $data) {
      message
    }
  }
`);

export const ContactForm = () => {
  const [submitContactForm, { data, error }] = useLazyQuery(mutation, {
    data: { name: "", email: "", subject: "", message: "" },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitContactForm({ data: { name, email, subject, message } });
    },
    [submitContactForm, name, email, subject, message],
  );

  return (
    <section className={styles.contactForm}>
      <form onSubmit={onSubmit}>
        <UIInputField
          id="name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <UIInputField
          id="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <UIInputField
          id="subject"
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <UITextArea
          id="message"
          placeholder="Write here your message."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <UIButton type="submit" variant="primary">
          Send
        </UIButton>
      </form>
    </section>
  );
};

export default ContactForm;
```

## Quick Override Reference

```tsx
// Minimal override example
import { NavbarSection, getOverriddenSection } from "@faststore/core";

const MyComponent = () => <p>Overridden Component</p>;

export default {
  Navbar: getOverriddenSection({
    Section: NavbarSection,
    components: {
      NavbarHeader: { Component: MyComponent },
    },
  }),
};
```

See [native-sections-and-overridable-slots](native-sections-and-overridable-slots.md) for the full list of sections and their overridable slot names.

## Debugging Custom Sections

### Reading framework source code

When hooks or context don't behave as expected, **read the framework source code** to understand the actual implementation:

**Source location**: `node_modules/@faststore/core/src/` and `node_modules/@faststore/sdk/src/`

**Key files to investigate**:

- `src/sdk/overrides/PageProvider.tsx` — page context types and `usePage()` implementation
- `src/components/templates/ProductListingPage/ProductListing.tsx` — PLP data merging (how `useProductGalleryQuery` merges into context)
- `src/components/templates/ProductDetailsPage/ProductDetailsPage.tsx` — PDP data merging
- `src/sdk/product/useProductGalleryQuery.ts` — client-side search query (facets source)

**Important**: The `.faststore/` folder is generated and should not be edited, but `node_modules/@faststore/*/src/` is readable and is the **ground truth** for API behavior when documentation is unclear or incomplete.

### Debugging checklist

When a custom section doesn't work as expected:

1. **Before writing code that consumes data from hooks or context**, read the source file of the hook in `node_modules/@faststore/core/src/` or `node_modules/@faststore/sdk/src/` to confirm the actual return type and API
2. **Never assume runtime data shapes from GraphQL schema alone** — GraphQL responses may include `__typename` instead of enum fields, may omit fields not in the selection set, or may restructure data through resolvers
3. **Check both server and client render phases** — data available on server may differ from data after client hydration (see [architecture.md](architecture.md) "Server vs Client Data Split")
