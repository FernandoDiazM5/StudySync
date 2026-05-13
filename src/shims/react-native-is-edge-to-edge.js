import { Platform } from 'react-native';

/**
 * El paquete stub en node_modules devuelve siempre `true` y keyboard-controller
 * fuerza navigationBarTranslucent en Android; el inset inferior a veces no basta
 * y la tab bar queda bajo los botones. En Android devolvemos false para respetar
 * `navigationBarTranslucent` / window real; en iOS se mantiene true.
 */
const edge = () => Platform.OS !== 'android';

export const isEdgeToEdgeFromLibrary = edge;
export const isEdgeToEdgeFromProperty = edge;
export const isEdgeToEdge = edge;
export const controlEdgeToEdgeValues = () => {};
