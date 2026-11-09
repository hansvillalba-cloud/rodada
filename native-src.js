import {BleClient} from '@capacitor-community/bluetooth-le';
import {registerPlugin} from '@capacitor/core';
window.Native={BleClient,BackgroundGeolocation:registerPlugin('BackgroundGeolocation')};
