import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVOURITES_KEY = '@favourites';

/**
 * Get all favourite contacts
 */
export const getFavourites = async () => {
  try {
    const favouritesJson = await AsyncStorage.getItem(FAVOURITES_KEY);
    return favouritesJson ? JSON.parse(favouritesJson) : [];
  } catch (error) {
    console.error('Error getting favourites:', error);
    return [];
  }
};

/**
 * Add a contact to favourites
 */
export const addFavourite = async (contact) => {
  try {
    const favourites = await getFavourites();
    
    // Check if already in favourites
    const exists = favourites.some(fav => fav.recordID === contact.recordID);
    if (exists) {
      return favourites;
    }
    
    const updatedFavourites = [...favourites, contact];
    await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(updatedFavourites));
    return updatedFavourites;
  } catch (error) {
    console.error('Error adding favourite:', error);
    throw error;
  }
};

/**
 * Remove a contact from favourites
 */
export const removeFavourite = async (recordID) => {
  try {
    const favourites = await getFavourites();
    const updatedFavourites = favourites.filter(fav => fav.recordID !== recordID);
    await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(updatedFavourites));
    return updatedFavourites;
  } catch (error) {
    console.error('Error removing favourite:', error);
    throw error;
  }
};

/**
 * Check if a contact is in favourites
 */
export const isFavourite = async (recordID) => {
  try {
    const favourites = await getFavourites();
    return favourites.some(fav => fav.recordID === recordID);
  } catch (error) {
    console.error('Error checking favourite:', error);
    return false;
  }
};

/**
 * Clear all favourites
 */
export const clearFavourites = async () => {
  try {
    await AsyncStorage.removeItem(FAVOURITES_KEY);
  } catch (error) {
    console.error('Error clearing favourites:', error);
    throw error;
  }
};
