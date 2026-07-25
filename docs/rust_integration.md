# Rust Toolchain Setup & Integration

This document describes how to set up the Rust toolchain and build the Rust proxy converter crate used by the backend.

## Prerequisites

1. **Rust & Cargo**:
   - Install Rust via [rustup](https://rustup.rs/):
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
   - Verify installation:
     ```bash
     cargo --version
     rustc --version
     ```

2. **C Compiler (for CGO builds)**:
   - Linux: `gcc` or `clang`
   - macOS: Xcode Command Line Tools (`xcode-select --install`)
   - Windows: MinGW-w64 (`gcc`) or MSVC

## Building the Rust Converter Crate

The Rust crate is located under `crates/mihombreng-converter`.

To build the release library manually:
```bash
cargo build --release --manifest-path crates/mihombreng-converter/Cargo.toml
```

## Backend Build Integration

When running `make build` from the `backend/` directory, Makefile automatically triggers the Rust crate build prior to compiling the Go binary:

```bash
cd backend
make build
```

## CGO and Fallback Modes

- **CGO Enabled (`CGO_ENABLED=1`)**:
  - `rust_cgo.go` is compiled.
  - Subscription parsing attempts high-performance Rust parsing first via FFI.
  - If Rust parsing fails or produces no proxies, it falls back to native Go parser.

- **Non-CGO (`CGO_ENABLED=0`)**:
  - `rust_nocgo.go` is compiled.
  - `IsRustAvailable()` returns `false`.
  - Backend seamlessly uses native Go parser.
