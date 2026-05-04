// Push notifications removidas — expo-notifications no soporta Expo Go SDK 53+
// Las notificaciones in-app se manejan en Firestore (colección 'notifications')

export const registerForPushNotifications = async (_userId) => null;
export const notifyNewMessage = async (_params) => {};
export const notifyGroupInvitation = async (_params) => {};
