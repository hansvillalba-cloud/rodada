// Añade los permisos de Bluetooth, GPS y servicio en primer plano al proyecto Android generado.
const fs=require('fs'),f='android/app/src/main/AndroidManifest.xml';let s=fs.readFileSync(f,'utf8');
if(!s.includes('BLUETOOTH_SCAN')){
 const P=['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','ACCESS_BACKGROUND_LOCATION','BLUETOOTH_SCAN','BLUETOOTH_CONNECT','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS','WAKE_LOCK']
  .map(p=>`    <uses-permission android:name="android.permission.${p}" />`).join('\n')
  +'\n    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />\n    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />\n    <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />\n';
 s=s.replace('</manifest>',P+'</manifest>');fs.writeFileSync(f,s);console.log('Permisos añadidos');}
