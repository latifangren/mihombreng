# Installation & Deployment on OpenWrt

This guide covers building, installing, configuring, and managing **Mihombreng** on routers running OpenWrt.

---

## 1. Prerequisites

### Storage Space
* The built core package (`mihombreng`) contains Go binaries for Mihombreng, Mihomo, static assets, and WebUI dashboards. It requires approximately **20–30MB** of free flash space.
* For routers with small flash memory, it is highly recommended to configure **extroot** (external storage overlay) before proceeding.

### Kernel Modules (Dependencies)
The core routing features require specific network modules. These are automatically selected as package dependencies, but ensure your system supports:
* `ca-bundle` (HTTPS support for subscription parsing)
* `ip-full` (IP rule routing)
* `kmod-tun` (TUN virtualization interface)
* `kmod-nft-core`, `kmod-nft-nat`, `kmod-nft-tproxy`, `kmod-nft-socket` (nftables redirection rules)

---

## 2. Building the Packages

You can compile the packages locally using the OpenWrt SDK or the bundled build scripts.

### Build via Makefile
Compile from the repository root:
```bash
# Clean previous builds
make clean

# Build package for target arch (e.g. aarch64_generic)
make openwrt-build ARCH=aarch64
```

### Build via Helper Script
```bash
# Build using target architecture
./scripts/build-openwrt.sh aarch64
```
Supported ARCH options: `x86_64`, `aarch64` (arm64), `armv7` (arm32), `mips` (mips_24kc).

The compiled package artifacts will be generated under the `build/` directory matching the targeted OpenWrt release format.

---

## 3. Transferring & Installing Packages

### Copy to Router
Copy the generated `.ipk` (OpenWrt <= 24.10) or `.apk` (OpenWrt >= 25.12) files using `scp`:
```bash
# For IPK (OpenWrt 24.10 and earlier)
scp build/mihombreng_*.ipk root@192.168.1.1:/tmp/
scp build/luci-app-mihombreng_*.ipk root@192.168.1.1:/tmp/

# For APK (OpenWrt 25.12+)
scp build/mihombreng_*.apk root@192.168.1.1:/tmp/
scp build/luci-app-mihombreng_*.apk root@192.168.1.1:/tmp/
```

### Install Packages
Log into your router via SSH and run:

**For OpenWrt 24.10 and earlier (using opkg):**
```bash
opkg update
opkg install /tmp/mihombreng_*.ipk
opkg install /tmp/luci-app-mihombreng_*.ipk
```

**For OpenWrt 25.12 and later (using apk):**
```bash
apk update
apk add --allow-untrusted /tmp/mihombreng_*.apk
apk add --allow-untrusted /tmp/luci-app-mihombreng_*.apk
```

---

## 4. Configuration

The default configuration files reside in `/etc/mihombreng/`.

### App Configuration (`/etc/mihombreng/mihombreng.yaml`)
Configure the Mihombreng server settings:
```yaml
version: "1.2.5"
environment: production
server:
  port: "7777"
  host: 0.0.0.0
  mode: release
mihomo:
  core_path: /usr/bin/mihomo
  config_path: /etc/mihombreng/configs/config.yaml
  working_dir: /etc/mihombreng
  auto_restart: true
  auto_start: true
logging:
  level: info
  file: /var/log/mihombreng.log
api:
  rate_limit: 100
  timeout: 30
  enable_swagger: false
  auth_token: "your-secure-token" # Set a token here to secure the API
```

### Security Hardening (Zero-Exposure Proxy)

To secure the Mihomo core process, configure the external controller in `/etc/mihombreng/configs/config.yaml` to listen locally only:
```yaml
external-controller: 127.0.0.1:9090
secret: "your-mihomo-secret"
```

Then in `/etc/mihombreng/mihombreng.yaml`, match that configuration:
```yaml
mihomo:
  api_url: http://127.0.0.1:9090
  api_secret: your-mihomo-secret
```
This isolates the Mihomo port `9090` from the network. The dashboard and all client requests will be securely routed through the Mihombreng API gateway on port `7777`.

### Warning: Dashboard UI Updates
If you use the built-in "Update" or "Upgrade" buttons inside external dashboard panels (like MetaCubeXD, Yacd, Zashboard) that trigger API upgrades via the Mihomo core process:
* **Risk**: The Mihomo upgrade API unzips the new dashboard directly into `/etc/mihombreng/ui/`, which **overwrites and deletes the other dashboards** under that directory (rendering it flat).
* **Prevention**: It is recommended to perform dashboard updates manually by extracting zip files into their respective subdirectories (e.g. `/etc/mihombreng/ui/metacubexd`) or change the `external-ui` value in `/etc/mihombreng/configs/config.yaml` to point directly to a specific subdirectory (e.g. `ui/metacubexd`) before updating, so it only extracts inside that subfolder.

---

## 5. Service Management

Mihombreng is controlled by the `procd` init system.

### CLI Control Commands
```bash
# Start the service
/etc/init.d/mihombreng start

# Stop the service
/etc/init.d/mihombreng stop

# Restart the service
/etc/init.d/mihombreng restart

# Enable auto-start on boot
/etc/init.d/mihombreng enable

# Check service status
/etc/init.d/mihombreng status
```

### Verifying Logs
To verify that everything is running correctly, inspect the logs:
```bash
tail -f /var/log/mihombreng.log
```

---

## 6. Accessing the Web UI

* **Mihombreng Direct Access**: Go to `http://<your-router-ip>:7777`
* **LuCI Integration**: Log into your OpenWrt Luci panel, and navigate to **Services -> Mihombreng**.
