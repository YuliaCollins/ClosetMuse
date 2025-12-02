
import { GoogleGenAI, Type } from "@google/genai";
import { StylingRequest, StyledLook } from "../types";
import { PARTNER_BRANDS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStylingAdvice = async (request: StylingRequest): Promise<StyledLook> => {
  const { profile } = request;

  // 1. Generate the Text Plan (Items & Makeup)
  const systemInstruction = `
    You are 'Closet Muse', a world-class personal stylist.
    
    Your goal is to create a complete outfit based on the user's request.
    
    CRITICAL INSTRUCTIONS:
    1. GOLDEN RULE: The User's Description ("${profile.description}") is the SINGLE MOST IMPORTANT input. Search and curate looks that match this description as closely as possible.
    2. Break the outfit down into KEY PIECES (Sections), e.g., "The Dress", "The Shoes", "Accessories".
    3. For EACH key piece, provide exactly 2 DISTINCT OPTIONS.
       - These options must be REALISTIC and likely to exist in current collections (Staples, Seasonal Trends).
       - MIX UP THE BRANDS.
       - ACTIVELY USE mass-market brands like Target, Uniqlo, Express, H&M, Zara, Banana Republic, and Aerie, especially if the budget matches.
       - Prioritize these partner brands if they fit: ${PARTNER_BRANDS.join(", ")}.
    4. If you choose a partner brand, mark 'isAffiliate' as true.
    5. Be specific with item names (e.g., "H&M Oversized Wool Blend Blazer" vs "Blazer").
    6. Consider stats: Height ${profile.height}, Weight ${profile.weight}, Sizes ${profile.sizes}.
    7. Respect Budget: ${profile.budget}.
    
    LINKING INSTRUCTIONS (CRITICAL - DIRECT STORE LINKS):
    - Users want to be taken DIRECTLY to the brand's website store page to buy the item.
    - Do NOT generate generic Google Search links if possible.
    - Construct the URL to search specifically on the brand's domain.
    - Use these patterns for major brands:
      * Target: "https://www.target.com/s?searchTerm={Keywords}"
      * Uniqlo: "https://www.uniqlo.com/us/en/search?q={Keywords}"
      * Express: "https://www.express.com/search?q={Keywords}"
      * H&M: "https://www2.hm.com/en_us/search-results.html?q={Keywords}"
      * Zara: "https://www.zara.com/us/en/search?searchTerm={Keywords}"
      * Banana Republic: "https://bananarepublic.gap.com/browse/search.do?searchText={Keywords}"
      * Aerie: "https://www.ae.com/us/en/s/{Keywords}"
      * Macy's: "https://www.macys.com/shop/featured/{Keywords-dashed}"
      * Amazon: "https://www.amazon.com/s?k={Keywords}"
      * Nordstrom: "https://www.nordstrom.com/sr?origin=keywordsearch&keyword={Keywords}"
    - For other brands, try to use their standard search URL pattern (e.g. domain.com/search?q=...).
    - Ensure keywords are URL encoded (spaces to %20 or +).
    - ONLY fallback to Google Shopping if the brand's site is unknown.
    
    Output strictly in JSON format matching the schema provided.
  `;

  const textPart = {
    text: `User Profile Details:
      User Request/Description: ${profile.description}
      Vibe/Style: ${profile.vibe}
      Celebrity Inspo: ${profile.celebrityInspo}
      Height: ${profile.height}
      Weight: ${profile.weight}
      Sizes: ${profile.sizes}
      Budget: ${profile.budget}
      Preferred Brands: ${profile.preferredBrands}
      
      Create a cohesive styled look with 2 distinct purchasing options for each piece. Ensure brand variety (Target, Uniqlo, Express, H&M, etc).`
  };

  try {
    // Step 1: Generate Text Styling
    const textResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: {
        parts: [textPart]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A catchy high-fashion name for this look" },
            description: { type: Type.STRING, description: "A detailed editorial description of why this works" },
            occasion: { type: Type.STRING, description: "Where to wear this" },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  categoryName: { type: Type.STRING, description: "e.g. 'The Structural Blazer'" },
                  curationReason: { type: Type.STRING, description: "Why this piece is essential for the look" },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        itemName: { type: Type.STRING },
                        description: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        priceEstimate: { type: Type.STRING },
                        searchQuery: { type: Type.STRING, description: "Keywords used for the link" },
                        itemLink: { type: Type.STRING, description: "Direct Brand Website Search URL" },
                        isAffiliate: { type: Type.BOOLEAN },
                      },
                      required: ["itemName", "brand", "isAffiliate", "searchQuery", "priceEstimate", "itemLink"]
                    }
                  }
                },
                required: ["categoryName", "curationReason", "options"]
              }
            },
            makeup: {
              type: Type.OBJECT,
              properties: {
                styleName: { type: Type.STRING },
                eyes: { type: Type.STRING },
                lips: { type: Type.STRING },
                face: { type: Type.STRING },
                tips: { type: Type.STRING },
              },
              required: ["eyes", "lips", "face", "styleName", "tips"]
            }
          }
        }
      }
    });

    const styledLook = JSON.parse(textResponse.text!) as StyledLook;
    
    // Attach the original profile so it can be edited/reused
    styledLook.originalProfile = profile;

    // Step 2: Generate Visual Image of the Look
    // We construct a prompt that combines the User's Description (Primary) with the chosen Items (Secondary).
    const visualPrompt = `
      Fashion photography, full body shot.
      Subject: A model wearing an outfit matching this specific user request: "${profile.description}".
      
      Key wardrobe items to visualize: ${styledLook.sections.map(s => s.options[0]?.itemName).join(", ")}.
      
      Style: ${styledLook.title}.
      Vibe: ${profile.vibe}.
      Aesthetic: High-fashion, photorealistic, studio lighting, neutral background, editorial quality.
    `;

    try {
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: visualPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            // imageSize removed: Not supported by gemini-2.5-flash-image
          }
        }
      });

      // Extract image
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          styledLook.generatedImage = part.inlineData.data;
          styledLook.generatedImageMimeType = part.inlineData.mimeType || "image/jpeg";
          break;
        }
      }
    } catch (imgError) {
      console.warn("Image generation failed, proceeding with text only:", imgError);
    }

    return styledLook;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
