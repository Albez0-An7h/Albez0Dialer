import Contacts from 'react-native-contacts';

/**
 * Normalize a phone number to last 10 digits for comparison
 */
const normalizeNumber = (number) => {
  if (!number) return '';
  const digits = number.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Build a phone number → { name, thumbnailPath } map from all contacts.
 * Call once and reuse. Returns a Map keyed by normalized (last-10-digit) number.
 */
export const buildContactPhotoMap = async () => {
  const map = new Map();
  try {
    const allContacts = await Contacts.getAll();
    for (const c of allContacts) {
      const thumb = c.hasThumbnail && c.thumbnailPath ? c.thumbnailPath : null;
      const name = c.displayName || null;
      if (c.phoneNumbers && c.phoneNumbers.length > 0) {
        for (const pn of c.phoneNumbers) {
          const key = normalizeNumber(pn.number);
          if (key) {
            map.set(key, { name, thumbnailPath: thumb });
          }
        }
      }
    }
  } catch (e) {
    console.warn('contactLookup: failed to build map', e);
  }
  return map;
};

/**
 * Look up a single phone number in the map.
 * Returns { name, thumbnailPath } or null.
 */
export const lookupContact = (map, phoneNumber) => {
  if (!map || !phoneNumber) return null;
  const key = normalizeNumber(phoneNumber);
  return map.get(key) || null;
};
