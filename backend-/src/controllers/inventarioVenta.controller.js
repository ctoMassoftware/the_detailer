import { pool } from '../config/db.js';

export const getProductos = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user;
  const { sede: sedeFiltro } = req.query;

  try {
    let query = 'SELECT * FROM inventario_venta';
    let params = [];

    if (rol !== 'SUPER_ADMIN') {
      query += ' WHERE sede = $1';
      params.push(sedeUsuario);
    } else if (sedeFiltro) {
      query += ' WHERE sede = $1';
      params.push(sedeFiltro);
    }

    query += ' ORDER BY id_producto_venta ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el inventario de venta' });
  }
};

export const createProducto = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user;
  const { nombre_producto, proveedor, categoria, ubicacion, costo, precio_venta, cantidad, sede, stock_minimo } = req.body;

  const sedeFinal = (rol === 'SUPER_ADMIN' && sede) ? sede : sedeUsuario;
  const stockMin = stock_minimo !== undefined ? stock_minimo : 5;

  try {
    const result = await pool.query(
      `INSERT INTO inventario_venta 
      (nombre_producto, proveedor, categoria, ubicacion, costo, precio_venta, cantidad, sede, stock_minimo) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [nombre_producto, proveedor, categoria, ubicacion, costo, precio_venta, cantidad, sedeFinal, stockMin]
    );
    res.json({ message: 'Producto creado', data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
};

export const updateProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre_producto, proveedor, categoria, ubicacion, costo, precio_venta, cantidad, stock_minimo } = req.body;
  const stockMin = stock_minimo !== undefined ? stock_minimo : 5;

  try {
    const result = await pool.query(
      `UPDATE inventario_venta 
       SET nombre_producto = $1, proveedor = $2, categoria = $3, ubicacion = $4, 
           costo = $5, precio_venta = $6, cantidad = $7, stock_minimo = $8 
       WHERE id_producto_venta = $9 RETURNING *`,
      [nombre_producto, proveedor, categoria, ubicacion, costo, precio_venta, cantidad, stockMin, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado', data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};

export const deleteProducto = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM inventario_venta WHERE id_producto_venta = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};