import { Router } from 'express';
import multer from 'multer';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  bulkDeleteItems,
  exportInventoryItems,
  importInventoryItems,
  getEquipmentAssignments,
  assignEquipment,
  unassignEquipment,
  getMaintenanceLogs,
  createMaintenanceLog,
  updateMaintenanceLog,
  getStockTransactions,
  createStockTransaction,
  updateServiceInstance,
  getServiceInstanceDetails,
} from '../controllers/inventoryController.js';
import { authenticate, requireAdmin, requireChef } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(authenticate);

router.get('/categories', getAllCategories);
router.post('/categories', requireAdmin, createCategory);
router.put('/categories/:id', requireAdmin, updateCategory);
router.delete('/categories/:id', requireAdmin, deleteCategory);

router.get('/items', getAllInventoryItems);
router.get('/items/:id', getInventoryItemById);
router.post('/items', requireAdmin, createInventoryItem);
router.put('/items/:id', requireChef, updateInventoryItem);
router.delete('/items/:id', requireAdmin, deleteInventoryItem);
router.post('/items/bulk-delete', requireAdmin, bulkDeleteItems);
router.get('/items/export/csv', requireAdmin, exportInventoryItems);
router.post('/items/import/csv', requireAdmin, upload.single('file'), importInventoryItems);

router.get('/assignments', getEquipmentAssignments);
router.post('/assignments', requireAdmin, assignEquipment);
router.put('/assignments/:id/unassign', requireAdmin, unassignEquipment);

router.get('/maintenance', getMaintenanceLogs);
router.post('/maintenance', requireAdmin, createMaintenanceLog);
router.put('/maintenance/:id', requireAdmin, updateMaintenanceLog);

router.get('/transactions', getStockTransactions);
router.post('/transactions', requireAdmin, createStockTransaction);

router.get('/service-instances/:id', getServiceInstanceDetails);
router.put('/service-instances/:id', requireAdmin, updateServiceInstance);

export default router;
