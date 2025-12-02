
export interface UserProfile {
  name: string;
  height: string;
  weight: string;
  sizes: string;
  vibe: string;
  celebrityInspo: string;
  budget: string;
  preferredBrands: string;
  description: string; // User's specific request
  notes: string;
}

export interface StylingRequest {
  profile: UserProfile;
}

export interface ClothingItem {
  itemName: string;
  description: string;
  brand: string;
  priceEstimate: string;
  searchQuery: string;
  itemLink: string; // Direct link to store/brand
  isAffiliate: boolean;
}

export interface LookSection {
  categoryName: string; // e.g. "The Statement Coat"
  curationReason: string; // Why this piece was chosen
  options: ClothingItem[]; // Several options for this piece
}

export interface MakeupLook {
  styleName: string;
  eyes: string;
  lips: string;
  face: string;
  tips: string;
}

export interface StyledLook {
  id?: string; // For saved looks
  date?: string; // Date saved
  originalProfile?: UserProfile; // The profile/inputs used to generate this look
  title: string;
  description: string;
  occasion: string;
  sections: LookSection[]; // Replaces flat list of items
  makeup: MakeupLook;
  generatedImage?: string; 
  generatedImageMimeType?: string;
}

export enum AppView {
  LANDING,
  FORM,
  LOADING,
  RESULT,
  SAVED,
}
