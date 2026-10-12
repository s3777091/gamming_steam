import { versionedMediaUrl } from './media-assets';

export type LoadingThemeId =
  | 'deep_space'
  | 'neon_city'
  | 'misty_wilds'
  | 'night_drive'
  | 'aurora'
  | 'dark_ocean'
  | 'desert_dreams'
  | 'snowbound';

export type LoadingThemePhoto = {
  image: string;
  source: string;
  photographer: string;
  alt: string;
};

export type LoadingTheme = {
  id: LoadingThemeId;
  label: string;
  detail: string;
  photos: readonly LoadingThemePhoto[];
};

export const DEFAULT_LOADING_THEME_ID: LoadingThemeId = 'deep_space';

// Every image below was selected from an individual Unsplash photo page and is
// available under the Unsplash License. Keep the source page beside the CDN URL
// so the picker and loading screen can always expose the original attribution.
export const LOADING_THEMES: readonly LoadingTheme[] = [
  {
    id: 'deep_space',
    label: 'Deep Space',
    detail: 'Tinh vân và bầu trời sao sâu thẳm',
    photos: [
      {
        image: '/media/loading/deep-space-1.jpg',
        source: 'https://unsplash.com/photos/nebula-rTZW4f02zY8',
        photographer: 'NASA',
        alt: 'Tinh vân xanh tím giữa không gian sâu',
      },
      {
        image: '/media/loading/deep-space-2.jpg',
        source: 'https://unsplash.com/photos/nebula-graphic-wallpaper-cXrzyV_RQPM',
        photographer: 'Arash',
        alt: 'Dải ngân hà tím trên bầu trời đêm',
      },
      {
        image: '/media/loading/deep-space-3.jpg',
        source: 'https://unsplash.com/photos/galaxy-mwhklqGVzck',
        photographer: 'Juskteez Vu',
        alt: 'Bầu trời đầy sao phản chiếu trên mặt hồ',
      },
    ],
  },
  {
    id: 'neon_city',
    label: 'Neon City',
    detail: 'Đô thị tương lai rực sáng về đêm',
    photos: [
      {
        image: '/media/loading/neon-city-1.jpg',
        source: 'https://unsplash.com/photos/a-futuristic-city-at-night-with-neon-lights-dA0-qxdbyyY',
        photographer: 'Nat',
        alt: 'Thành phố tương lai với ánh đèn neon',
      },
      {
        image: '/media/loading/neon-city-2.jpg',
        source: 'https://unsplash.com/photos/cityscape-at-night-with-train-tracks-and-lights-8xHvdmuxnWY',
        photographer: 'Kei Selma',
        alt: 'Đường tàu xuyên qua thành phố Jakarta về đêm',
      },
      {
        image: '/media/loading/neon-city-3.jpg',
        source: 'https://unsplash.com/photos/cityscape-at-night-with-bright-neon-signs-PT3NkH6FazI',
        photographer: 'Tianlei Wu',
        alt: 'Phố đêm châu Á với biển hiệu neon rực rỡ',
      },
    ],
  },
  {
    id: 'misty_wilds',
    label: 'Misty Wilds',
    detail: 'Rừng núi phủ sương, trầm và điện ảnh',
    photos: [
      {
        image: '/media/loading/misty-wilds-1.jpg',
        source: 'https://unsplash.com/photos/BCgYISXm4Os',
        photographer: 'Iswanto Arif',
        alt: 'Núi rừng Indonesia chìm trong mây sớm',
      },
      {
        image: '/media/loading/misty-wilds-2.jpg',
        source: 'https://unsplash.com/photos/a-foggy-forest-with-a-mountain-in-the-background-L4jXDAzSiFU',
        photographer: 'Katelyn G',
        alt: 'Rừng thông tối với núi phủ sương phía xa',
      },
      {
        image: '/media/loading/misty-wilds-3.jpg',
        source: 'https://unsplash.com/photos/mountains-with-fog-YLYfwyPJl-o',
        photographer: 'Sean Pierce',
        alt: 'Thung lũng núi và thác nước trong sương',
      },
    ],
  },
  {
    id: 'night_drive',
    label: 'Night Drive',
    detail: 'Mưa, tốc độ và ánh đèn thành phố',
    photos: [
      {
        image: '/media/loading/night-drive-1.jpg',
        source: 'https://unsplash.com/photos/cars-on-road-at-night-time-HS5XEwndvsM',
        photographer: 'Patrick Robert Doyle',
        alt: 'Dòng xe dưới mưa tại Times Square về đêm',
      },
      {
        image: '/media/loading/night-drive-2.jpg',
        source: 'https://unsplash.com/photos/car-on-road-during-night-time--SmISBviVDo',
        photographer: 'Cole Parrant',
        alt: 'Khung cảnh nhìn qua kính xe trong đêm mưa',
      },
      {
        image: '/media/loading/night-drive-3.jpg',
        source: 'https://unsplash.com/photos/black-car-on-road-during-night-time-gsFDI6xzJdw',
        photographer: 'Benjamin Lehman',
        alt: 'Chiếc xe lao nhanh qua phố đêm nhòe sáng',
      },
    ],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    detail: 'Cực quang trên núi tuyết phương Bắc',
    photos: [
      {
        image: '/media/loading/aurora-1.jpg',
        source: 'https://unsplash.com/photos/snow-capped-mountain-under-aurora-lights-SgsK-fpGSo8',
        photographer: 'Jonathan Wheeler',
        alt: 'Cực quang trên dãy núi phủ tuyết Alaska',
      },
      {
        image: '/media/loading/aurora-2.jpg',
        source: 'https://unsplash.com/photos/the-aurora-bore-in-the-night-sky-over-a-snow-covered-field-RiPxavpvk70',
        photographer: 'Stephan Deinhamer',
        alt: 'Cực quang xanh trên cánh đồng tuyết Lapland',
      },
      {
        image: '/media/loading/aurora-3.jpg',
        source: 'https://unsplash.com/photos/aurora-borealis-Eh7Q7ALqiWY',
        photographer: 'Martin Brechtl',
        alt: 'Cực quang phản chiếu trên mặt nước Iceland',
      },
    ],
  },
  {
    id: 'dark_ocean',
    label: 'Dark Ocean',
    detail: 'Sóng biển xanh thẫm nhìn từ trên cao',
    photos: [
      {
        image: '/media/loading/dark-ocean-1.jpg',
        source: 'https://unsplash.com/photos/an-aerial-view-of-a-wave-in-the-ocean-p_VHz_c17M0',
        photographer: 'Geio Tischler',
        alt: 'Người lướt sóng giữa làn nước xanh thẫm ở Bali',
      },
      {
        image: '/media/loading/dark-ocean-2.jpg',
        source: 'https://unsplash.com/photos/an-aerial-view-of-the-ocean-with-waves-C2Ols93xssQ',
        photographer: 'Daniel Gomez',
        alt: 'Những lớp sóng đại dương nhìn từ trên cao',
      },
      {
        image: '/media/loading/dark-ocean-3.jpg',
        source: 'https://unsplash.com/photos/aerial-view-of-ocean-waves-C-opW0i5McE',
        photographer: 'Jeremy Bishop',
        alt: 'Bọt sóng trắng trên mặt biển xanh đậm',
      },
    ],
  },
  {
    id: 'desert_dreams',
    label: 'Desert Dreams',
    detail: 'Cồn cát vàng, hoàng hôn và trời sao',
    photos: [
      {
        image: '/media/loading/desert-dreams-1.jpg',
        source: 'https://unsplash.com/photos/sand-dunes-during-sunset-4cloovdyuvw',
        photographer: 'Fabian Struwe',
        alt: 'Những cồn cát Sahara dưới hoàng hôn vàng',
      },
      {
        image: '/media/loading/desert-dreams-2.jpg',
        source: 'https://unsplash.com/photos/a-group-of-sand-dunes-in-the-desert-HEf0fKgJA1Q',
        photographer: 'Zetong Li',
        alt: 'Đường cong mềm của cồn cát tại Death Valley',
      },
      {
        image: '/media/loading/desert-dreams-3.jpg',
        source: 'https://unsplash.com/photos/milky-way-view-during-night-TXu4dwPh7dM',
        photographer: 'Gavin Spear',
        alt: 'Dải ngân hà trên sa mạc Joshua Tree',
      },
    ],
  },
  {
    id: 'snowbound',
    label: 'Snowbound',
    detail: 'Đỉnh núi tuyết lạnh dưới bầu trời đêm',
    photos: [
      {
        image: '/media/loading/snowbound-1.jpg',
        source: 'https://unsplash.com/photos/snow-covered-mountain-during-nighttime-ddLiNMqWAOM',
        photographer: 'Tyler Lastovich',
        alt: 'Đỉnh Aoraki phủ tuyết trong màn đêm xanh',
      },
      {
        image: '/media/loading/snowbound-2.jpg',
        source: 'https://unsplash.com/photos/snow-covered-mountain-during-night-time-qgDhCd3bXqo',
        photographer: 'Toan Chu',
        alt: 'Núi Rainier phủ tuyết phản chiếu lúc chạng vạng',
      },
      {
        image: '/media/loading/snowbound-3.jpg',
        source: 'https://unsplash.com/photos/snow-coated-mountain-at-night-time-n1PFjN_--Xk',
        photographer: 'Jonathan Wheeler',
        alt: 'Siêu trăng trên dãy núi tuyết Alaska',
      },
    ],
  },
] as const;

export function isLoadingThemeId(value: unknown): value is LoadingThemeId {
  return typeof value === 'string' && LOADING_THEMES.some((theme) => theme.id === value);
}

export function getLoadingTheme(value: unknown): LoadingTheme {
  return LOADING_THEMES.find((theme) => theme.id === value) ?? LOADING_THEMES[0];
}

export function loadingPhotoUrl(photo: LoadingThemePhoto): string {
  return versionedMediaUrl(photo.image);
}
