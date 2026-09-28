# ORBITWAKE

Original planetary sandbox. Prospect three biomes, dig soil, print modules, ride a rover, and sell cosmetics.

This is **not** Astroneer and does not use System Era assets, names, or code. The screenshot you sent is that game. Orbitwake is a new IP in the same *genre*: colorful low-poly worlds, oxygen tethers, and outpost building.

## Play

Open `index.html` in a browser (needs network once for the Three.js CDN) or deploy the folder as static hosting.

- **WASD / left stick** move
- **E / GATHER** pick up resin and ore
- **DIG + Space** excavate
- **B / BUILD** place printed modules
- **C / SHOP** crystals and cosmetics
- **Esc** back to the drift map

Worlds

- Ember Hollow — crimson dunes, bone trees
- Hexcore — neon lattice and a floating core
- Tide Crown — blue flats and coral canopies

## Make money (real)

The shop is wired as a **sandbox checkout**. Tapping a cash pack grants crystals locally so you can test economy feel. It does not charge a card.

To take real money:

1. Create a Stripe account and a product per pack (`Starter $0.99`, `Pioneer $4.99`, `Founder $9.99`).
2. Add a tiny backend (Cloudflare Worker or Vercel route) that creates a Checkout Session and, on `checkout.session.completed`, credits that player.
3. Replace the `buy()` IAP branch in `game.js` with a redirect to that session.
4. Keep worlds, gathering, and building **free**. Charge skins, trails, and convenience only. Stores reject paywalls that lock the actual game.

Do not ship "buy oxygen or die" as the only loop. The habitat tether already refills O2 for free.

## Save

Progress lives in `localStorage` key `orbitwake_v1`. New Drift wipes it.

## Next slice

- Server accounts + anti-cheat crystal balance
- Shared outposts
- Fourth world + caves
- Suit workshop using your Inkbound / Tattoos And Scars look
