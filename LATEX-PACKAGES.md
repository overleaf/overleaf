# LaTeX Package Management in Overleaf Community Edition

## Pre-installed Packages

This custom Overleaf setup includes commonly-needed LaTeX packages pre-installed:

- **koma-script** - KOMA-Script document classes (scrbook, scrartcl, etc.)
- **babel-german** - German language support
- **nth** - Formatting of nth numbers
- **listings** - Source code listings
- **appendix** - Appendix formatting
- **subfigure** - Subfigures in LaTeX
- **csquotes** - Context-sensitive quotations
- **collection-latexextra** - Large collection of extra LaTeX packages (~2000 packages)
- **collection-fontsrecommended** - Recommended font packages
- **collection-latexrecommended** - Recommended LaTeX packages

## First-Time Setup

1. Build the custom image:
   ```powershell
   docker-compose build
   ```

2. Start Overleaf:
   ```powershell
   docker-compose up -d
   ```

3. Access at http://localhost and create your admin account at http://localhost/launchpad

## Installing Additional Packages

**Important**: Overleaf Community Edition does NOT auto-install missing packages. You must install them manually.

### Method 1: Add to Dockerfile (Recommended)

1. Edit `Dockerfile.custom` and add the package to the `tlmgr install` line:
   ```dockerfile
   RUN tlmgr install \
       koma-script \
       babel-german \
       your-new-package \
       ...
   ```

2. Rebuild the image:
   ```powershell
   docker-compose build --no-cache sharelatex
   docker-compose up -d
   ```

### Method 2: Install in Running Container (Temporary)

Packages installed this way will be LOST if the container is recreated.

```powershell
# Install a single package
docker exec sharelatex tlmgr install package-name

# Install multiple packages
docker exec sharelatex tlmgr install package1 package2 package3

# Restart to ensure packages are available
docker-compose restart sharelatex
```

### Finding Package Names

If your LaTeX document shows "File 'xyz.sty' not found":

1. Search for the package on CTAN: https://www.ctan.org/
2. The package name is usually the filename without `.sty`
3. Install with: `docker exec sharelatex tlmgr install package-name`

## Common Missing Packages

If you encounter missing packages, here are some common ones:

- `algorithmicx` - Algorithm typesetting
- `biblatex-ieee` - IEEE bibliography style
- `siunitx` - SI units formatting
- `todonotes` - TODO notes in documents
- `xcolor` - Extended color support
- `tikz` - Graphics and diagrams (part of pgf package)

## Package Collections

Installing collections provides many packages at once:

- `collection-latexextra` - Extra LaTeX packages (very large, ~2GB)
- `collection-mathscience` - Math and science packages
- `collection-fontsextra` - Extra fonts
- `collection-publishers` - Publisher-specific packages

## Troubleshooting

### Compilation fails with "File not found"
1. Note the filename (e.g., `abc.sty`)
2. Install the package: `docker exec sharelatex tlmgr install abc`
3. Restart: `docker-compose restart sharelatex`

### Package installed but still not found
1. Update TeX database: `docker exec sharelatex texhash`
2. Verify location: `docker exec sharelatex kpsewhich package.sty`
3. If using Debian packages instead of tlmgr, they install to `/usr/share/texlive` which TeX Live 2025 doesn't see. Always use `tlmgr`.

### German hyphenation warning
The warning about German hyphenation patterns is harmless. To fix it properly, you'd need to rebuild the LaTeX format files with German patterns, but English patterns work fine for most documents.

## Persistence

- **Packages in Dockerfile**: Persistent across container recreations ✅
- **Packages via `docker exec tlmgr`**: Lost when container is recreated ❌
- **User documents**: Persistent (stored in volumes) ✅

Always add frequently-used packages to the Dockerfile for a permanent solution.
