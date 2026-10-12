import { Image, type ImageProps } from 'expo-image';

/** expo-image với cache đĩa: ảnh Steam không phải tải lại mỗi lần mở kệ game. */
export function Img(props: ImageProps) {
  return <Image cachePolicy="memory-disk" transition={220} {...props} />;
}
