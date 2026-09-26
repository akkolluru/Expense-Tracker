import React from 'react';
import { 
  Utensils, 
  ShoppingBag, 
  Car, 
  Package, 
  Zap, 
  Film, 
  HeartPulse, 
  TrendingUp, 
  Wallet, 
  HelpCircle,
  LucideIcon
} from 'lucide-react';
import { ExpenseCategory } from '../types';
import { CATEGORIES_CONFIG } from '../data/mockData';

interface CategoryIconProps {
  category: ExpenseCategory;
  size?: number;
  className?: string;
  showBg?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 20, 
  className = '',
  showBg = true
}) => {
  const config = CATEGORIES_CONFIG[category] || CATEGORIES_CONFIG['Uncategorized'];

  const getIcon = (): LucideIcon => {
    switch (category) {
      case 'Food & Dining':
        return Utensils;
      case 'Groceries & Quick-Commerce':
        return ShoppingBag;
      case 'Transportation':
        return Car;
      case 'Shopping & E-Commerce':
        return Package;
      case 'Utilities & Bills':
        return Zap;
      case 'Entertainment & Subscriptions':
        return Film;
      case 'Health & Medical':
        return HeartPulse;
      case 'Investments & Savings':
        return TrendingUp;
      case 'Salary & Income':
        return Wallet;
      default:
        return HelpCircle;
    }
  };

  const IconComponent = getIcon();

  if (!showBg) {
    return <IconComponent size={size} style={{ color: config.colorHex }} className={className} />;
  }

  return (
    <div 
      className={`flex items-center justify-center rounded-xl transition-transform ${className}`}
      style={{ 
        backgroundColor: config.bgTintHex,
        width: size + 16,
        height: size + 16,
      }}
    >
      <IconComponent size={size} style={{ color: config.colorHex }} />
    </div>
  );
};
