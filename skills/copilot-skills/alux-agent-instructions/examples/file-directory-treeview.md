# File and Directory TreeView Examples

These examples follow the standard for documenting file and directory structures: Mermaid `treeView-beta` with Material Icon Theme icons.

Reference the [Mermaid documentation](https://mermaid.js.org/), the [diagram syntax index](https://mermaid.js.org/syntax/), and [Iconify Material Icon Theme](https://icon-sets.iconify.design/material-icon-theme/) when validating renderer support and selecting icons.

## Declare the Icon Pack First

Mermaid does not bundle third-party icon packs. Register the Material Icon Theme pack before rendering any `treeView-beta` diagram:

```js
import mermaid from 'mermaid';

mermaid.registerIconPacks([
  {
    name: 'material-icon-theme',
    loader: () =>
      fetch('https://unpkg.com/@iconify-json/material-icon-theme@1/icons.json')
        .then((response) => response.json()),
  },
]);
```

Then declare the default pack in the TreeView configuration. The `icon(...)` annotation can use the registered pack name:

```mermaid
---
config:
  treeView:
    showIcons: true
    defaultIconPack: material-icon-theme
---
treeView-beta
    project/ icon(material-icon-theme:folder)
        README.md icon(material-icon-theme:markdown)
```

## Basic Project Tree

Use an explicit Material Icon Theme icon on every node.

```mermaid
---
config:
  treeView:
    showIcons: true
    defaultIconPack: material-icon-theme
---
treeView-beta
    alux/ icon(material-icon-theme:folder)
        src/ icon(material-icon-theme:folder-src)
            index.ts icon(material-icon-theme:typescript)
        package.json icon(material-icon-theme:json)
        README.md icon(material-icon-theme:markdown)
        Dockerfile icon(material-icon-theme:docker)
```

## Go Gateway Tree

Use file-type-specific Material icons for Go source, tests, module metadata, and Markdown.

```mermaid
---
config:
  treeView:
    showIcons: true
    defaultIconPack: material-icon-theme
---
treeView-beta
    gateway/ icon(material-icon-theme:folder)
        cmd/ icon(material-icon-theme:folder-src)
            alux-gateway/ icon(material-icon-theme:folder)
                main.go icon(material-icon-theme:go)
        proxy/ icon(material-icon-theme:folder-src)
            server.go icon(material-icon-theme:go)
            server_test.go icon(material-icon-theme:go-test)
        go.mod icon(material-icon-theme:go-mod)
        README.md icon(material-icon-theme:markdown)
```

## Multi-Module Skill Tree

Use Material icons to make module boundaries and file types immediately identifiable.

```mermaid
---
config:
  treeView:
    showIcons: true
    defaultIconPack: material-icon-theme
---
treeView-beta
    skills/ icon(material-icon-theme:folder)
        shared/ icon(material-icon-theme:folder)
            alux-agent-instructions/ icon(material-icon-theme:folder)
                SKILL.md icon(material-icon-theme:markdown)
                examples/ icon(material-icon-theme:folder)
                    file-directory-treeview.md icon(material-icon-theme:markdown)
        jimmer-java/ icon(material-icon-theme:folder-java)
            src/ icon(material-icon-theme:folder-src)
                main.java icon(material-icon-theme:java)
        jimmer-kotlin/ icon(material-icon-theme:folder-kotlin)
            src/ icon(material-icon-theme:folder-src)
                main.kt icon(material-icon-theme:kotlin)
        shared-resources/ icon(material-icon-theme:folder-resource)
            schema.sql icon(material-icon-theme:database)
            data.sql icon(material-icon-theme:database)
```

## Rendering Requirements

- Keep the `treeView-beta` keyword as the diagram type.
- Register the `material-icon-theme` icon pack before Mermaid renders the diagram.
- Set `defaultIconPack: material-icon-theme` in the `treeView` configuration.
- Add `icon(material-icon-theme:<name>)` to every file and directory node.
- Select folder icons for directories and file-type-specific icons for files.
