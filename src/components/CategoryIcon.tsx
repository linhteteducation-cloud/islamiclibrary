import {
  Baby,
  BookOpen,
  Clock,
  FileSearch,
  Heart,
  HeartHandshake,
  History,
  Newspaper,
  Scale,
  ScrollText,
  Star,
  Video,
} from 'lucide-react';
import {CategoryItem} from '../types/library';

interface CategoryIconProps {
  name: CategoryItem['iconName'];
  className?: string;
}

export function CategoryIcon({name, className = 'w-5 h-5'}: CategoryIconProps) {
  switch (name) {
    case 'book-open':
      return <BookOpen className={className} />;
    case 'scroll-text':
      return <ScrollText className={className} />;
    case 'scale':
      return <Scale className={className} />;
    case 'heart-handshake':
      return <HeartHandshake className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'history':
      return <History className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'baby':
      return <Baby className={className} />;
    case 'newspaper':
      return <Newspaper className={className} />;
    case 'file-search':
      return <FileSearch className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'video':
      return <Video className={className} />;
  }
}
