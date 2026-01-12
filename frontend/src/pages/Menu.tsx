import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { ordersAPI } from '@/lib/api';
import { CartItem, MenuItem, QRContext } from '@/lib/types';
import { formatCurrency } from '@/lib/types';
import { MENU_ITEMS, CATEGORY_LABELS, getMenuItemsByCategory, MenuCategory } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const qrContext = (location.state?.qrContext || {}) as QRContext;
  const sessionId = location.state?.sessionId as string | undefined;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'all'>('all');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getMenuItems(true);
      if (data && data.length > 0) {
        setMenuItems(data);
      }
    } catch (error) {
      console.error('Failed to load menu, using local data:', error);
      setMenuItems(MENU_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  const categories: MenuCategory[] = ['chinese', 'sandwiches', 'pasta', 'beverages'];
  const displayItems = selectedCategory === 'all'
    ? menuItems.filter(item => item.available)
    : getMenuItemsByCategory(selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map(ci =>
          ci.menuItem.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
    toast({
      title: 'Added to cart',
      description: `${item.name} added to your cart`,
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(ci => ci.menuItem.id === itemId);
      if (!item) return prev;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter(ci => ci.menuItem.id !== itemId);
      }

      return prev.map(ci =>
        ci.menuItem.id === itemId
          ? { ...ci, quantity: newQuantity }
          : ci
      );
    });
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add items to your cart.',
        variant: 'destructive',
      });
      return;
    }

    navigate('/checkout', {
      state: {
        cart,
        qrContext,
        sessionId,
      },
    });
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Menu
            </h1>
            <p className="text-sm text-muted-foreground">
              Food & Beverages
            </p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="glass"
          >
            All
          </Button>
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="glass"
            >
              {CATEGORY_LABELS[category]}
            </Button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-4 mb-24">
          {displayItems.map((item, index) => {
            const cartItem = cart.find(ci => ci.menuItem.id === item.id);
            const quantity = cartItem?.quantity || 0;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-foreground shrink-0 ml-4">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {quantity > 0 ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addToCart(item)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Cart Summary (Fixed Bottom) */}
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t p-4 shadow-lg"
          >
            <div className="container max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <span className="font-medium">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(totalAmount)}
                </div>
              </div>
              <Button
                variant="glow"
                size="lg"
                className="w-full"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

