import * as ImagePicker from 'expo-image-picker';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

export class PhotoPermissionError extends Error {
  canOpenSettings: boolean;
  constructor(canOpenSettings: boolean) {
    super('Chưa được cấp quyền truy cập ảnh. Bạn có thể cấp quyền chỉ cho những ảnh muốn dùng.');
    this.canOpenSettings = canOpenSettings;
  }
}

/** Request only when the user chooses the device library, never for Storage. */
export async function ensurePhotoLibraryPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const sdk = Number(Platform.Version);
    const full = sdk >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const selected = PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED;
    const permissions: Permission[] = sdk >= 34 ? [full, selected] : [full];
    const existing = await Promise.all(permissions.map(permission => PermissionsAndroid.check(permission)));
    if (existing.some(Boolean)) return;
    // Expo ImagePicker's SDK 57 permission method is a no-op on Android 13+.
    // Explicit image-only requests also allow Android 14's selected-photo grant.
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (permissions.some(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) return;
    throw new PhotoPermissionError(permissions.some(permission => result[permission] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN));
  }
  if (Platform.OS === 'ios') {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync(false);
    if (!permission.granted && permission.accessPrivileges !== 'limited' && permission.canAskAgain) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    }
    if (permission.granted || permission.accessPrivileges === 'limited') return;
    throw new PhotoPermissionError(!permission.canAskAgain);
  }
}
