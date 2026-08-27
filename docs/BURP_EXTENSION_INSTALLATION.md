# Burp Extension Installation

## Build
From repository root:

Linux/macOS:
```bash
cd integrations/burp-extension
./gradlew clean build
```

Windows:
```powershell
cd integrations/burp-extension
.\gradlew.bat clean build
```

Output JAR:
`integrations/burp-extension/build/libs/burp-dashboard-extension-0.1.0.jar`

## Load into Burp
1. Burp → Extensions → Installed → Add
2. Type: Java
3. Select built JAR
4. Load class: `com.pentestdashboard.burp.PenTestDashboardExtension`

## Configure
In Burp "PT Dashboard" tab, set:
- Dashboard URL
- API token
- Engagement ID
- Target ID (optional)
- Default Finding ID (optional)

Use **Test Connection**/traffic actions from context menu to validate.
