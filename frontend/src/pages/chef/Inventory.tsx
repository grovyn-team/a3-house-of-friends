import { useState, useEffect } from "react";
import { ChefLayout } from "@/components/chef/ChefLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inventoryAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Edit, X as XIcon, ChevronLeft, ChevronRight, Package } from "lucide-react";

export default function ChefInventory() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    loadData(1);
  }, [selectedCategory, selectedType, lowStockOnly, searchTerm]);

  const loadData = async (page = pagination.page, limit = pagination.limit) => {
    try {
      setLoading(true);
      const queryParams: any = {
        page,
        limit,
      };
      
      if (selectedCategory !== "all") queryParams.categoryId = selectedCategory;
      if (selectedType !== "all") queryParams.type = selectedType;
      if (lowStockOnly) queryParams.lowStock = true;
      if (searchTerm) queryParams.search = searchTerm;

      const [itemsData, categoriesData] = await Promise.all([
        inventoryAPI.getItems(queryParams),
        inventoryAPI.getCategories(),
      ]);
      
      setItems(itemsData.items || itemsData || []);
      setCategories(categoriesData || []);
      
      if (itemsData.pagination) {
        setPagination(itemsData.pagination);
      }
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load inventory data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (itemData: any) => {
    try {
      if (editingItem) {
        await inventoryAPI.updateItem(editingItem._id || editingItem.id, { currentStock: itemData.currentStock });
        toast({
          title: "Success",
          description: "Stock quantity updated successfully.",
        });
      }
      setIsDialogOpen(false);
      setEditingItem(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock quantity.",
        variant: "destructive",
      });
    }
  };

  const lowStockItems = items.filter(
    (item) => item.stockTracking === 'quantity' && item.currentStock <= item.minStockLevel
  );

  return (
    <ChefLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">View and update stock quantities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{lowStockItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Consumables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {items.filter((i) => i.type === "consumable").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items by name, SKU, description, brand, model, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11 text-base"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm("")}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat._id || cat.id} value={cat._id || cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                    <SelectItem value="furniture">Furniture</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="lowStock"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="lowStock" className="cursor-pointer">
                    Low Stock Only
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
            <CardDescription>
              {pagination.total} item(s) total • Page {pagination.page} of {pagination.pages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                No items found
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const itemId = item._id || item.id;
                    return (
                    <TableRow key={itemId}>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.categoryId?.name || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "active"
                              ? "default"
                              : item.status === "maintenance"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.stockTracking === "quantity" ? (
                          <div className="flex items-center gap-2">
                            <span>{item.currentStock || 0} {item.unit || 'pieces'}</span>
                            {item.currentStock <= item.minStockLevel && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              (min: {item.minStockLevel || 0})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{item.location || "N/A"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingItem(item);
                            setIsDialogOpen(true);
                          }}
                          title="Update stock quantity"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} items
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadData(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let pageNum;
                        if (pagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.pages - 2) {
                          pageNum = pagination.pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => loadData(pageNum)}
                            disabled={loading}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadData(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Stock Quantity</DialogTitle>
            </DialogHeader>
            <ItemForm
              item={editingItem}
              categories={categories}
              onSubmit={handleUpdateItem}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingItem(null);
              }}
              isChef={true}
            />
          </DialogContent>
        </Dialog>
      </div>
    </ChefLayout>
  );
}

function ItemForm({ item, categories, onSubmit, onCancel, isChef = false }: any) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    sku: item?.sku || "",
    categoryId: item?.categoryId?._id || item?.categoryId || "",
    type: item?.type || "equipment",
    description: item?.description || "",
    brand: item?.brand || "",
    itemModel: item?.itemModel || "",
    status: item?.status || "active",
    stockTracking: item?.stockTracking || "none",
    currentStock: item?.currentStock || 0,
    minStockLevel: item?.minStockLevel || 0,
    maxStockLevel: item?.maxStockLevel || 0,
    unit: item?.unit || "pieces",
    location: item?.location || "",
    costPrice: item?.costPrice || 0,
    sellingPrice: item?.sellingPrice || 0,
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : "",
    warrantyExpiry: item?.warrantyExpiry ? new Date(item.warrantyExpiry).toISOString().split('T')[0] : "",
    notes: item?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isChef) {
      onSubmit({ currentStock: Number(formData.currentStock) });
    } else {
      const submitData = {
        ...formData,
        categoryId: formData.categoryId,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : undefined,
        warrantyExpiry: formData.warrantyExpiry ? new Date(formData.warrantyExpiry) : undefined,
        currentStock: formData.stockTracking === "quantity" ? Number(formData.currentStock) : undefined,
        minStockLevel: formData.stockTracking === "quantity" ? Number(formData.minStockLevel) : undefined,
        maxStockLevel: formData.stockTracking === "quantity" ? Number(formData.maxStockLevel) : undefined,
        costPrice: Number(formData.costPrice) || undefined,
        sellingPrice: Number(formData.sellingPrice) || undefined,
      };
      onSubmit(submitData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category *</Label>
          <Select
            value={formData.categoryId}
            onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
            disabled={isChef}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat: any) => (
                <SelectItem key={cat._id || cat.id} value={cat._id || cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
            disabled={isChef}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="consumable">Consumable</SelectItem>
              <SelectItem value="furniture">Furniture</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={isChef}
          className={isChef ? "cursor-not-allowed" : ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="itemModel">Model</Label>
          <Input
            id="itemModel"
            value={formData.itemModel}
            onChange={(e) => setFormData({ ...formData, itemModel: e.target.value })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
            disabled={isChef}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockTracking">Stock Tracking</Label>
          <Select
            value={formData.stockTracking}
            onValueChange={(value) => setFormData({ ...formData, stockTracking: value })}
            disabled={isChef}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="quantity">Quantity</SelectItem>
              <SelectItem value="serialized">Serialized</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.stockTracking === "quantity" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currentStock">Current Stock</Label>
            <Input
              id="currentStock"
              type="number"
              value={formData.currentStock}
              onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minStockLevel">Min Stock Level</Label>
            <Input
              id="minStockLevel"
              type="number"
              value={formData.minStockLevel}
              onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
              disabled={isChef}
              className={isChef ? "cursor-not-allowed" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxStockLevel">Max Stock Level</Label>
            <Input
              id="maxStockLevel"
              type="number"
              value={formData.maxStockLevel}
              onChange={(e) => setFormData({ ...formData, maxStockLevel: Number(e.target.value) })}
              disabled={isChef}
              className={isChef ? "cursor-not-allowed" : ""}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="pieces, kg, liters, etc."
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="costPrice">Cost Price (₹)</Label>
          <Input
            id="costPrice"
            type="number"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
          <Input
            id="sellingPrice"
            type="number"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
            disabled={isChef}
            className={isChef ? "cursor-not-allowed" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          disabled={isChef}
          className={isChef ? "cursor-not-allowed" : ""}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{isChef ? "Update Stock" : "Update"}</Button>
      </div>
    </form>
  );
}
