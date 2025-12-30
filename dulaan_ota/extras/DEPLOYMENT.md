# OTA Web Tool Deployment Guide

## Method 1: GitHub Pages (Recommended for China)

**Advantages:**
- ✅ Free HTTPS hosting
- ✅ Accessible in China mainland
- ✅ No server maintenance
- ✅ Automatic updates from repo

### Setup Steps:

1. **Enable GitHub Pages** (one-time setup):
   ```
   1. Go to: https://github.com/LennoxSears/dulaan_ble/settings/pages
   2. Under "Source", select: "Deploy from a branch"
   3. Under "Branch", select: "main" and "/root"
   4. Click "Save"
   5. Wait 1-2 minutes for deployment
   ```

2. **Access URL**:
   ```
   https://lennoxsears.github.io/dulaan_ble/extras/ota-web-tool.html
   ```

3. **Share with users**:
   - Send the URL above
   - Users open in Chrome/Edge on Android
   - No app installation needed

### Update Process:

When you update the firmware:
```bash
# 1. Build new firmware
cd SDK
make ac632n_spp_and_le

# 2. Commit and push
git add SDK/cpu/bd19/tools/app.bin
git commit -m "Update firmware to vX.X"
git push origin main

# 3. GitHub Pages auto-updates in ~1 minute
```

---

## Method 2: Gitee Pages (Alternative for China)

**If GitHub is slow in your region:**

1. **Mirror to Gitee** (Chinese GitHub alternative):
   ```
   1. Go to: https://gitee.com/projects/import/url
   2. Paste: https://github.com/LennoxSears/dulaan_ble
   3. Click "Import"
   ```

2. **Enable Gitee Pages**:
   ```
   1. Go to repo settings → Pages
   2. Click "Enable"
   3. Select branch: main
   ```

3. **Access URL**:
   ```
   https://[your-username].gitee.io/dulaan_ble/extras/ota-web-tool.html
   ```

**Note**: Gitee Pages requires manual sync after each GitHub update.

---

## Method 3: Cloudflare Pages (Advanced)

**For custom domain:**

1. **Sign up**: https://pages.cloudflare.com
2. **Connect GitHub repo**: dulaan_ble
3. **Build settings**:
   - Build command: (none)
   - Build output: /
4. **Deploy**

**Advantages:**
- Fast CDN in China
- Custom domain support
- Free SSL

---

## Method 4: Local Network (No Internet)

**For factory/testing environment:**

1. **On any computer in local network**:
   ```bash
   cd dulaan_ble/extras
   python3 -m http.server 8000
   ```

2. **Find computer's IP**:
   ```bash
   # Linux/Mac
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

3. **Access from any device on same network**:
   ```
   http://192.168.1.XXX:8000/ota-web-tool.html
   ```

---

## Recommended: GitHub Pages

**Why:**
- Zero configuration
- Already set up (just enable in settings)
- Works in China
- Free forever
- HTTPS included

**URL to share**:
```
https://lennoxsears.github.io/dulaan_ble/extras/ota-web-tool.html
```

**Test it works**:
1. Enable GitHub Pages (see steps above)
2. Wait 2 minutes
3. Open URL in Chrome on Android
4. Should see "VibMotor OTA" page
5. Click "Connect" to test Bluetooth

---

## Troubleshooting

### "404 Not Found"
- Wait 2-3 minutes after enabling GitHub Pages
- Check branch is set to "main"
- Verify file exists at: `extras/ota-web-tool.html`

### "Web Bluetooth not supported"
- Must use Chrome/Edge browser
- Must be HTTPS (GitHub Pages provides this)
- Check browser version (need Chrome 56+)

### Slow in China
- Use Gitee Pages mirror
- Or use Cloudflare Pages with China CDN

### Need custom domain
- Use Cloudflare Pages
- Or add custom domain in GitHub Pages settings
