const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas
const uri = "mongodb+srv://angel:Inamorta5@serverlessinstance0.jpasihl.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0";
const client = new MongoClient(uri);

const dbName = "BYMU";
console.log('Conectando a la base de datos:', dbName);

const usersCollection = "user";
const routesCollection = "route";
const outingsCollection = "outing";

// === USER ENDPOINTS ===

// Registrar usuario
app.post('/registerUser', async (req, res) => {
  try {
    const user = req.body;
    const exists = await client.db(dbName).collection(usersCollection)
      .findOne({ email: user.email });
    if (exists) return res.status(400).json({ error: "User already exists" });
    const result = await client.db(dbName).collection(usersCollection).insertOne(user);
    res.json({ ...user, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar usuario por _id
app.put('/editUser/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const result = await client.db(dbName).collection(usersCollection)
      .findOneAndUpdate(
        { _id: new ObjectId(id) }, 
        { $set: fields }, 
        { returnDocument: "after" }
      );
    if (result.value) {
        res.json(result.value);
    } else {
      // Buscar el usuario manualmente si no se modificó nada pero el usuario existe
        const user = await client.db(dbName).collection(usersCollection)
          .findOne({ _id: new ObjectId(id) });
        if (user) res.json(user);
        else res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar usuario por _id
app.delete('/deleteUser/:id', async (req, res) => {
  try {
    const deleteResult = await client.db(dbName).collection(usersCollection).deleteOne({ _id: new ObjectId(req.params.id) });
    if (deleteResult.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar usuarios por username
app.get('/findUserByUsername/:username', async (req, res) => {
  try {
    const users = await client.db(dbName).collection(usersCollection)
      .find({ username: req.params.username }).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener usuario por _id
app.get('/getUser/:id', async (req, res) => {
  try {
    const user = await client.db(dbName).collection(usersCollection)
      .findOne({ _id: new ObjectId(req.params.id) });
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOGIN POR EMAIL Y PASSWORD ---
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await client.db(dbName).collection(usersCollection)
      .findOne({ email, password });
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ROUTE ENDPOINTS ===

// Añadir ruta
app.post('/addRoute', async (req, res) => {
  try {
    const route = req.body;
    if (
      route.locationStart &&
      route.locationStart.latitude !== undefined &&
      route.locationStart.longitude !== undefined
    ) {
      route.locationStart = {
        type: "Point",
        coordinates: [
          Number(route.locationStart.longitude),
          Number(route.locationStart.latitude)
        ]
      };
    }
    const result = await client.db(dbName).collection(routesCollection).insertOne(route);
    res.json({ ...route, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar ruta
app.put('/editRoute/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const fields = req.body;
    if (
      fields.locationStart &&
      fields.locationStart.latitude !== undefined &&
      fields.locationStart.longitude !== undefined
    ) {
      fields.locationStart = {
        type: "Point",
        coordinates: [
          Number(fields.locationStart.longitude),
          Number(fields.locationStart.latitude)
        ]
      };
    }
    const updateResult = await client.db(dbName).collection(routesCollection)
      .updateOne({ _id: new ObjectId(routeId) }, { $set: fields });
    if (updateResult.matchedCount === 1) {
      const updatedRoute = await client.db(dbName).collection(routesCollection)
        .findOne({ _id: new ObjectId(routeId) });
      res.json(updatedRoute);
    } else {
      res.status(404).json({ error: "Route not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar ruta por _id
app.delete('/deleteRoute/:routeId', async (req, res) => {
  try {
    const deleteResult = await client.db(dbName).collection(routesCollection).deleteOne({ _id: new ObjectId(req.params.routeId) });
    if (deleteResult.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Route not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar rutas por parámetros
app.post('/searchRoutes', async (req, res) => {
  try {
    const params = req.body;
    let query = {};

    // 1. Filtro por dificultad si está
    if (params.difficulty !== undefined && params.difficulty !== null)
      query.difficulty = params.difficulty;

    // 2. Filtro geoespacial (si hay location y radio)
    if (
      params.location &&
      typeof params.location.latitude === 'number' &&
      typeof params.location.longitude === 'number'
    ) {
      // radio en km o metros, según tu app
      const radiusKm = params.radiusKm && typeof params.radiusKm === 'number'
        ? params.radiusKm
        : 25;// valor por defecto (25 km)

      // $geoWithin y $centerSphere (radio en radianes: km / 6378.1)
      query['locationStart'] = {
        $geoWithin: {
          $centerSphere: [
            [params.location.longitude, params.location.latitude],
            radiusKm / 6378.1
          ]
        }
      };
    }

    // 3. Filtro opcional por fecha (no lo usas por defecto)
    // ...

    // Búsqueda y respuesta
    const routes = await client.db(dbName).collection(routesCollection).find(query).toArray();
    res.json(routes);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener una ruta por su ID
app.get('/getRouteById/:routeId', async (req, res) => {
  try {
    const routeId = req.params.routeId;
    // Log para depuración:
    console.log('Buscando ruta con id:', routeId, 'en DB:', dbName, 'colección:', routesCollection);
    const route = await client.db(dbName).collection(routesCollection)
      .findOne({ _id: new ObjectId(routeId) });
    if (!route) {
      console.log("No encontrada en la colección", routesCollection, "de la base", dbName);
      return res.status(404).json({ error: "Route not found" });
    }
    res.json(route);
  } catch (error) {
    console.error("ERROR en getRouteById:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// === OUTING ENDPOINTS ===

// Añadir Outing
app.post('/addOuting', async (req, res) => {
  try {
    const outing = req.body;
    const result = await client.db(dbName).collection(outingsCollection).insertOne(outing);
    res.json({ ...outing, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar Outing por _id
app.delete('/deleteOuting/:outingId', async (req, res) => {
  try {
    const deleteResult = await client.db(dbName).collection(outingsCollection).deleteOne({ _id: new ObjectId(req.params.outingId) });
    if (deleteResult.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Outing not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Devuelve solo los routeId de las salidas del usuario
app.get('/getRoutesByUser/:userId', async (req, res) => {
  try {
    const outings = await client.db(dbName).collection(outingsCollection)
      .find({ userId: req.params.userId }).project({ routeId: 1, _id: 0 }).toArray();
    const routeIds = outings.map(o => o.routeId);
    res.json(routeIds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Devuelve solo los userId de las salidas para esa ruta
app.get('/getUsersByRoute/:routeId', async (req, res) => {
  try {
    const outings = await client.db(dbName).collection(outingsCollection)
      .find({ routeId: req.params.routeId }).project({ userId: 1, _id: 0 }).toArray();
    const userIds = outings.map(o => o.userId);
    res.json(userIds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener la outing concreta de un usuario en una ruta
app.get('/getUserOuting/:userId/:routeId', async (req, res) => {
  try {
    const outing = await client.db(dbName).collection(outingsCollection)
      .findOne({ userId: req.params.userId, routeId: req.params.routeId });
    if (outing) res.json(outing);
    else res.status(404).json({ error: "Outing not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Puerto
const PORT = process.env.PORT || 3000;
client.connect().then(() => {
  app.listen(PORT, () => {
    console.log('Servidor Express escuchando en puerto', PORT);
  });
}).catch(console.error);
