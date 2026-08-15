import { cartItemSchema, cartItemUpdateSchema, idParamSchema } from '@looksave/validation';
import { Router } from 'express';

import { localeOf } from '../catalog/locale';
import { getAuth, requireAuth } from '../http/auth-middleware';
import { sendData } from '../http/respond';
import { route } from '../http/validate';
import { addCartItem, clearCart, getCart, removeCartItem, updateCartItem } from '../orders/cart';

export const cartRouter: Router = Router();

// Savat — faqat o'z egasiga
cartRouter.use('/cart', requireAuth);

/** GET /v1/cart — do'konlar bo'yicha bo'lingan savat */
cartRouter.get('/cart', async (req, res) => {
  sendData(res, await getCart(getAuth(res).sub, localeOf(req)));
});

/** POST /v1/cart/items */
cartRouter.post(
  '/cart/items',
  route({ body: cartItemSchema }, async (input, req, res) => {
    await addCartItem(getAuth(res).sub, input.body);
    sendData(res, await getCart(getAuth(res).sub, localeOf(req)), 201);
  }),
);

/** PATCH /v1/cart/items/:id */
cartRouter.patch(
  '/cart/items/:id',
  route({ params: idParamSchema, body: cartItemUpdateSchema }, async (input, req, res) => {
    await updateCartItem(getAuth(res).sub, input.params.id, input.body.qty);
    sendData(res, await getCart(getAuth(res).sub, localeOf(req)));
  }),
);

/** DELETE /v1/cart/items/:id */
cartRouter.delete(
  '/cart/items/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    await removeCartItem(getAuth(res).sub, input.params.id);
    sendData(res, await getCart(getAuth(res).sub, localeOf(req)));
  }),
);

/** DELETE /v1/cart */
cartRouter.delete('/cart', async (req, res) => {
  await clearCart(getAuth(res).sub);
  sendData(res, await getCart(getAuth(res).sub, localeOf(req)));
});
