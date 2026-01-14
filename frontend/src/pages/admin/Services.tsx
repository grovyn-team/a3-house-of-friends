import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { activitiesAPI, inventoryAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Package, Settings, Link as LinkIcon } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import { useConfirmation } from "@/components/ui/confirmation-dialog";

export default function Services() {
  const { toast } = useToast();
  const { confirm, ConfirmationDialog } = useConfirmation();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isInstanceDialogOpen, setIsInstanceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [editingInstance, setEditingInstance] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [equipmentAssignments, setEquipmentAssignments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const activitiesData = await activitiesAPI.getAll();
      setActivities(activitiesData || []);
    } catch (error: any) {
      console.error("Failed to load services:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load services data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEquipmentAssignments = async (instanceId: string) => {
    try {
      const assignments = await inventoryAPI.getAssignments({ serviceInstanceId: instanceId, active: true });
      setEquipmentAssignments(assignments || []);
    } catch (error: any) {
      console.error("Failed to load equipment assignments:", error);
    }
  };

  const handleCreateService = async (serviceData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(serviceData),
      });
      
      if (!response.ok) throw new Error('Failed to create service');
      
      toast({
        title: "Success",
        description: "Service created successfully.",
      });
      setIsServiceDialogOpen(false);
      setEditingService(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save service.",
        variant: "destructive",
      });
    }
  };

  const handleCreateInstance = async (instanceData: any) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/activities/${selectedService}/units`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify(instanceData),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create instance');
      
      toast({
        title: "Success",
        description: "Service instance created successfully.",
      });
      setIsInstanceDialogOpen(false);
      setEditingInstance(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save instance.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInstance = async (instanceId: string, instanceData: any) => {
    try {
      await inventoryAPI.updateServiceInstance(instanceId, instanceData);
      toast({
        title: "Success",
        description: "Service instance updated successfully.",
      });
      setIsInstanceDialogOpen(false);
      setEditingInstance(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update instance.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    confirm({
      title: "Delete Instance?",
      description: "Are you sure you want to delete this instance? This action cannot be undone.",
      variant: "destructive",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/activities/units/${instanceId}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              },
            }
          );
          
          if (!response.ok) throw new Error('Failed to delete instance');
          
          toast({
            title: "Success",
            description: "Service instance deleted successfully.",
          });
          loadData();
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to delete instance.",
            variant: "destructive",
          });
          throw error;
        }
      },
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Service Management</h1>
            <p className="text-muted-foreground">Manage services and their instances</p>
          </div>
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingService(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
              </DialogHeader>
              <ServiceForm
                service={editingService}
                onSubmit={handleCreateService}
                onCancel={() => {
                  setIsServiceDialogOpen(false);
                  setEditingService(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Services List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">No services found</div>
          ) : (
            activities.map((activity) => (
              <Card key={activity.id || activity._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{activity.name}</CardTitle>
                    <Badge variant={activity.enabled ? "default" : "secondary"}>
                      {activity.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <CardDescription>{activity.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pricing:</span>
                      <span className="font-medium">
                        {formatCurrency(activity.baseRate)} / {activity.pricingType === 'per-minute' ? 'min' : activity.pricingType === 'per-hour' ? 'hr' : 'session'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Min Duration:</span>
                      <span className="font-medium">{activity.minimumDuration} min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Instances:</span>
                      <span className="font-medium">{activity.units?.length || 0}</span>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedService(activity._id || activity.id);
                          setIsInstanceDialogOpen(true);
                          setEditingInstance(null);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Instance
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Instances Table */}
        <Card>
          <CardHeader>
            <CardTitle>Service Instances</CardTitle>
            <CardDescription>Manage individual service instances</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Instance Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.flatMap((activity) =>
                  (activity.units || []).map((unit: any) => (
                    <TableRow key={unit.id}>
                      <TableCell>{activity.name}</TableCell>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            unit.status === "available"
                              ? "default"
                              : unit.status === "occupied"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {unit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{unit.location || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              setEditingInstance(unit);
                              setSelectedService(activity._id || activity.id);
                              setIsInstanceDialogOpen(true);
                              await loadEquipmentAssignments(unit.id);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInstance(unit.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Instance Dialog */}
        <Dialog open={isInstanceDialogOpen} onOpenChange={setIsInstanceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInstance ? "Edit Instance" : "Add New Instance"}
              </DialogTitle>
            </DialogHeader>
            <InstanceForm
              instance={editingInstance}
              serviceId={selectedService}
              equipmentAssignments={equipmentAssignments}
              onSubmit={editingInstance ? 
                (data: any) => handleUpdateInstance(editingInstance.id, data) :
                handleCreateInstance
              }
              onCancel={() => {
                setIsInstanceDialogOpen(false);
                setEditingInstance(null);
                setEquipmentAssignments([]);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmationDialog />
    </AdminLayout>
  );
}

function ServiceForm({ service, onSubmit, onCancel }: any) {
  const [formData, setFormData] = useState({
    type: service?.type || "",
    name: service?.name || "",
    description: service?.description || "",
    pricingType: service?.pricingType || "per-minute",
    baseRate: service?.baseRate || 0,
    minimumDuration: service?.minimumDuration || 30,
    duration: service?.duration || undefined,
    bufferTime: service?.bufferTime || 5,
    enabled: service?.enabled !== undefined ? service.enabled : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="type">Type *</Label>
        <Input
          id="type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          placeholder="e.g., snooker-standard, playstation"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pricingType">Pricing Type *</Label>
          <Select
            value={formData.pricingType}
            onValueChange={(value) => setFormData({ ...formData, pricingType: value })}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per-minute">Per Minute</SelectItem>
              <SelectItem value="per-hour">Per Hour</SelectItem>
              <SelectItem value="fixed-duration">Fixed Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseRate">Base Rate (₹) *</Label>
          <Input
            id="baseRate"
            type="number"
            value={formData.baseRate}
            onChange={(e) => setFormData({ ...formData, baseRate: Number(e.target.value) })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minimumDuration">Minimum Duration (min) *</Label>
          <Input
            id="minimumDuration"
            type="number"
            value={formData.minimumDuration}
            onChange={(e) => setFormData({ ...formData, minimumDuration: Number(e.target.value) })}
            required
          />
        </div>
        {formData.pricingType === "fixed-duration" && (
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration || ""}
              onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bufferTime">Buffer Time (min) *</Label>
          <Input
            id="bufferTime"
            type="number"
            value={formData.bufferTime}
            onChange={(e) => setFormData({ ...formData, bufferTime: Number(e.target.value) })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="enabled">Status</Label>
          <Select
            value={formData.enabled ? "enabled" : "disabled"}
            onValueChange={(value) => setFormData({ ...formData, enabled: value === "enabled" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

function InstanceForm({ instance, serviceId, equipmentAssignments, onSubmit, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: instance?.name || "",
    status: instance?.status || "available",
    location: instance?.location || "",
    notes: instance?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Instance Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Zone A, Floor 1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      {equipmentAssignments.length > 0 && (
        <div className="space-y-2">
          <Label>Assigned Equipment</Label>
          <div className="border rounded-lg p-3 space-y-2">
            {equipmentAssignments.map((assignment: any) => (
              <div key={assignment._id || assignment.id} className="flex items-center justify-between text-sm">
                <span>{assignment.inventoryItemId?.name || 'N/A'}</span>
                <Badge variant="outline">{assignment.inventoryItemId?.sku || 'N/A'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
