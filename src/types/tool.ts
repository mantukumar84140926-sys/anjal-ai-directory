export interface Tool {
  id: string;
  name: string;
  slug: string;
  logo: string;
  website: string;
  description: string;
  categories: string[];
  pricingType: string;
  platforms: string[];
  rating: number | null;
  reviewCount: number;
  features: string[];
  tags: string[];
  isTrending: boolean;
  isFeatured: boolean;
  isNew: boolean;
  verificationStatus: string;
  sourceUrl?: string;
  dataSource?: string;
  dataSourceNote?: string;
  verificationScope?: string;
  lastVerified?: string;
}
