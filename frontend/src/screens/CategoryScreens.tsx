import React from 'react';
import CategoryScreen from './CategoryScreen';

// Passing {...props} cleanly hands over 'navigation' and 'route' to the main screen
export const PrivateScreen: React.FC<any> = (props) => (
  <CategoryScreen {...props} category="Private" />
);

export const PublicScreen: React.FC<any> = (props) => (
  <CategoryScreen {...props} category="Public" />
);

export const RestrictedScreen: React.FC<any> = (props) => (
  <CategoryScreen {...props} category="Restricted" />
);

export const TrashScreen: React.FC<any> = (props) => (
  <CategoryScreen {...props} category="Trash" />
);