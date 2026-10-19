# Getting Started

## Install

```bash
npm install
npm link
```

## Your first book

Put your chapters in a folder, numbered for ordering:

```text
my-book/
├── book.yaml          # title, author, theme...
├── README.md          # preface (unnumbered)
├── 01-intro.md
├── 02-usage.md
└── images/
```

Then run `md2pdf my-book/`.

## Overview

This heading has the same name as one in the preface; ids stay unique per chapter. See the [preface overview](README.md#overview).
