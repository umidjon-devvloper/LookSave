/*
 * React 19 va @types/react 19 global `JSX` namespace'ini olib tashladi —
 * endi u `React.JSX` ichida. Ilovada 100+ joyda `JSX.Element` ishlatiladi;
 * hammasini qayta yozmasdan, global shim bilan eski nomni React.JSX'ga
 * tegishli qilib qo'yamiz. Natijada kod o'zgarmasdan ishlaydi va tiplar
 * React 19 bilan to'g'ri boriladi.
 */
import type * as React from 'react';

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty;
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}

export {};
