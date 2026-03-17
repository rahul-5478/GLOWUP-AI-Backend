const axios = require("axios");

// ─── Single hairstyle image fetch ────────────────────────────────────────────
const searchHairstyleImage = async (hairstyleName, gender) => {
  try {
    const genderWord = gender?.toLowerCase() === "female" ? "women" : "men";
    const query = `${hairstyleName} ${genderWord} hairstyle haircut`;

    const response = await axios.get("https://api.pexels.com/v1/search", {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
      params: {
        query,
        per_page: 3,
        orientation: "portrait",
      },
      timeout: 8000,
    });

    const photos = response.data.photos;
    if (photos && photos.length > 0) {
      // Random photo pick karo taaki har baar different image mile
      const randomIndex = Math.floor(Math.random() * photos.length);
      return photos[randomIndex].src.medium;
    }
    return null;
  } catch (err) {
    console.error(`Pexels error for "${hairstyleName}":`, err.message);
    return null;
  }
};

// ─── Multiple hairstyles ke liye parallel fetch ───────────────────────────────
const attachImagesToHairstyles = async (hairstyles, gender) => {
  if (!process.env.PEXELS_API_KEY) {
    console.warn("⚠️ PEXELS_API_KEY not set — skipping image search");
    return hairstyles;
  }

  const results = await Promise.all(
    hairstyles.map(async (style) => {
      const imageUrl = await searchHairstyleImage(style.name, gender);
      return {
        ...style,
        realImage: imageUrl || null, // null hoga toh frontend fallback use karega
      };
    })
  );

  return results;
};

module.exports = { searchHairstyleImage, attachImagesToHairstyles };