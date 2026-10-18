/**
 * ============================================================================
 *  CONFIGURACIÓN DE LA IGLESIA
 *  Este es el ÚNICO archivo que necesitas editar para personalizar la web:
 *  nombre, dirección, teléfono, horarios, redes y el mapa.
 * ============================================================================
 */

export interface ScheduleItem {
  title: string;
  detail: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  contact: {
    address: string;
    city: string;
    country: string;
    email: string;
  };
  maps: {
    /** Dirección que se buscará en Google Maps. */
    query: string;
    /** URL del iframe (no necesita API Key de Google). */
    embedUrl: string;
    /** Enlace "Cómo llegar". */
    directionsUrl: string;
  };
  schedule: ScheduleItem[];
  social: SocialLink[];
}

/** Dirección textual de la iglesia (respaldo para el botón "Cómo llegar"). */
const MAPS_QUERY = 'Calle José Palanca, Barrio del Torcal, Málaga, España';

export const SITE: SiteConfig = {
  name: 'Iglesia Jesús Agua Viva',
  shortName: 'Jesús Agua Viva',
  tagline: 'Un lugar para encontrarte con Dios',
  description:
    'Somos una iglesia que cree en el poder transformador de Jesús. Te esperamos con los brazos abiertos: ven como estás.',

  contact: {
    address: 'C. José Palanca, Carretera de Cádiz, 29003 Málaga',
    city: 'Málaga',
    country: 'España',
    email: 'jesusaguaviva57@gmail.com',
  },

  maps: {
    query: MAPS_QUERY,
    // `output=embed` permite incrustar el mapa sin API Key de Google Maps.
    embedUrl: `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3198.871274321731!2d-4.450134025455377!3d36.70163107325188!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72f77d1ef4c747%3A0x94ed0c4de6ef7012!2sIglesia%20Cristiana%20Evang%C3%A9lica%20Jesus%20Agua%20Viva!5e0!3m2!1ses!2ses!4v1792314883125!5m2!1ses!2ses" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
    directionsUrl: `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3198.871274321731!2d-4.450134025455377!3d36.70163107325188!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72f77d1ef4c747%3A0x94ed0c4de6ef7012!2sIglesia%20Cristiana%20Evang%C3%A9lica%20Jesus%20Agua%20Viva!5e0!3m2!1ses!2ses!4v1792314883125!5m2!1ses!2ses" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
  },

  schedule: [
    { title: 'Domingo', detail: 'Culto · 11:30 a.m.' },
    { title: 'Domingo', detail: 'Reunión de Jóvenes · 16:00 p.m.' },
    { title: 'Viernes', detail: 'Reunión de Oración · 19:00 p.m.' },
  ],

  social: [
    { label: 'Facebook', href: 'https://www.facebook.com/jesusaguaviva57/' },
    { label: 'Instagram', href: 'https://instagram.com/iglesia_jesus_agua_viva' },
    { label: 'YouTube', href: 'https://www.youtube.com/@iglesia_jesus_agua_viva' },
  ],
};

/** Email de la iglesia: es el único canal de contacto de la web. */
export const CONTACT_EMAIL = SITE.contact.email;
