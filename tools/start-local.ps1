param([ValidateSet('backend','frontend','preview','jar')][string]$Part='backend')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$runtimeRoot=Join-Path $projectRoot 'runtime'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$settingsPath=Join-Path $runtimeRoot 'local.env'
if(!(Test-Path -LiteralPath $settingsPath)){
 $generatedKey=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
 $generatedPassword='Xuexu-'+[guid]::NewGuid().ToString('N')
 @("DB_URL=jdbc:mysql://127.0.0.1:3306/xuexu?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai","DB_USERNAME=root","DB_PASSWORD=","JWT_SECRET=$generatedKey","ADMIN_PASSWORD=$generatedPassword","PORT=8081")|Set-Content -LiteralPath $settingsPath -Encoding utf8
 Write-Host "已生成本机配置：$settingsPath。请填写 DB_PASSWORD，再重新运行。首次管理员用户名为 admin。"
 exit 1
}
foreach($line in Get-Content -LiteralPath $settingsPath){if($line -match '^([A-Z_]+)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2],'Process')}}
Set-Location -LiteralPath $projectRoot
if($Part -in 'backend','jar'){
 if(Test-Path 'D:\JDK\jdk-21\bin\java.exe'){$env:JAVA_HOME='D:\JDK\jdk-21'}
 if($Part -eq 'jar'){
  $jarPath=Join-Path $projectRoot 'backend\target\xuexu-backend-2.0.0.jar'
  if(!(Test-Path -LiteralPath $jarPath)){throw '请先运行 mvn -f backend/pom.xml package。'}
  $javaCommand=if($env:JAVA_HOME){Join-Path $env:JAVA_HOME 'bin\java.exe'}else{'java.exe'}
  & $javaCommand -jar $jarPath
  exit $LASTEXITCODE
 }
 $mavenCommand=Get-Command mvn.cmd -ErrorAction SilentlyContinue
 $mavenPath=if($mavenCommand){$mavenCommand.Source}else{'D:\JetBrains\IntelliJ IDEA\plugins\maven-plugin\lib\maven3\bin\mvn.cmd'}
 if(!(Test-Path -LiteralPath $mavenPath)){throw '未找到 Maven；请安装 Maven 并加入 PATH。'}
 & $mavenPath -B -ntp -f backend/pom.xml spring-boot:run
}else{
 $env:API_TARGET="http://127.0.0.1:$($env:PORT)"
 if($Part -eq 'frontend'){& npm.cmd --prefix frontend run dev}
 else{& node tools/serve-production.mjs}
}
exit $LASTEXITCODE
