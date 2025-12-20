# Repository Size Analysis

## Total Size: 952 MB

### Breakdown by Directory:

| Directory | Size | Purpose |
|-----------|------|---------|
| SDK/ | 584 MB | JieLi AC632N SDK (complete) |
| .git/ | ~368 MB | Git history |
| README.md | 16 KB | Documentation |
| Other files | < 1 MB | Config files |

---

## SDK Directory Breakdown (584 MB):

| Directory | Size | Contents |
|-----------|------|----------|
| **cpu/** | 265 MB | Chip-specific code for 6 different chips |
| **patch_release/** | 188 MB | SDK patches and updates |
| **doc/** | 68 MB | Documentation and datasheets |
| **sdk_tools/** | 38 MB | Development tools |
| **apps/** | 21 MB | Example applications |
| **include_lib/** | 4.7 MB | Libraries |

---

## Largest Files:

| File | Size | Can Remove? |
|------|------|-------------|
| `SDK/patch_release/v2.2.1_update_to_v2.3.0_patch.rar` | 84 MB | ✅ Yes (old patch) |
| `SDK/cpu/bd19/tools/sdk.lst` | 16 MB | ⚠️ Build artifact |
| `SDK/cpu/bd19/tools/sdk.elf.*.bc` | 9.2 MB each | ⚠️ Build artifacts |
| `SDK/doc/datasheet/AC632N/AC632N用户手册.pdf` | 7 MB | ❌ Keep (reference) |
| `SDK/cpu/*/liba/btctrler.a` | 5-6 MB each | ❌ Keep (required) |

---

## Unused Chip Directories (Can Remove):

We only use **bd19** (AC632N). Other chips not needed:

| Chip | Directory | Size | Remove? |
|------|-----------|------|---------|
| br30 | SDK/cpu/br30/ | 44 MB | ✅ Yes |
| br34 | SDK/cpu/br34/ | 42 MB | ✅ Yes |
| br23 | SDK/cpu/br23/ | 42 MB | ✅ Yes |
| br25 | SDK/cpu/br25/ | 39 MB | ✅ Yes |
| bd29 | SDK/cpu/bd29/ | 21 MB | ✅ Yes |

**Total savings**: ~188 MB

---

## Recommendations:

### Option 1: Clean Build Artifacts (Safe)
Remove temporary build files:
```bash
cd SDK/cpu/bd19/tools
rm -f sdk.lst *.bc
```
**Savings**: ~35 MB

### Option 2: Remove Old Patches (Safe)
```bash
rm -rf SDK/patch_release/v2.2.1_update_to_v2.3.0_patch.rar
```
**Savings**: 84 MB

### Option 3: Remove Unused Chips (Moderate Risk)
Remove chip directories we don't use:
```bash
cd SDK/cpu
rm -rf br23 br25 br30 br34 bd29
```
**Savings**: ~188 MB
**Risk**: If you ever need to support other chips, you'll need to restore SDK

### Option 4: Keep Only Essential Docs (Moderate Risk)
```bash
cd SDK/doc
# Keep only: datasheet/AC632N, FAQ
rm -rf mesh操作演示 天猫精灵* 涂鸦* 蓝牙AT* USB* HiLink* 腾讯*
```
**Savings**: ~20 MB

---

## Total Possible Savings:

| Action | Savings | Risk |
|--------|---------|------|
| Clean build artifacts | 35 MB | None |
| Remove old patches | 84 MB | None |
| Remove unused chips | 188 MB | Low |
| Remove unused docs | 20 MB | Low |
| **TOTAL** | **327 MB** | |

**Final size**: 952 MB → 625 MB (34% reduction)

---

## Git History Size:

`.git/` directory is ~368 MB due to:
- Android-JL_OTA was added then removed (still in history)
- Multiple large files committed

To reduce git history (advanced):
```bash
# This rewrites history - use with caution
git filter-repo --path Android-JL_OTA --invert-paths
```

**Not recommended** unless you need to reduce clone size significantly.
