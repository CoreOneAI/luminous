Luminous Salon API — drop-in catalog/search fix (no UI changes)

1) Install & run locally
   npm i
   node server.js
   -> GET http://127.0.0.1:10000/__whoami
   -> GET http://127.0.0.1:10000/api/products?q=anti-aging&limit=8

2) Render setup
   - Environment tab: add CATALOG_PATH = salon_inventory.json
   - Save -> redeploy
   - Verify: https://<your-app>/__whoami shows source and count

3) Endpoints
   GET  /api/products?q=term&limit=24&offset=0
   POST /api/chat  { "message": "purple shampoo" }  -> returns response + items[]
   POST /api/bookings/create { ... } -> bookingId
   POST /__reload_catalog   -> hot reload after updating the JSON
   GET  /__whoami           -> diagnostics

4) Files
   - server.js
   - products.schema.json
   - import_csv_to_inventory.mjs
   - public/images/placeholder.svg
