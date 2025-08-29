'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    ExternalLink,
    Clock,
    CheckCircle,
    AlertTriangle,
    Package,
    Truck,
    CreditCard,
    Share2,
    Heart,
    ArrowRight
} from 'lucide-react';

interface ShoppingCartProps {
    layout: Layout;
    onUpdateCart?: (items: CartItem[]) => void;
}

interface Layout {
    id: string;
    name: string;
    placements: Placement[];
}

interface Placement {
    furniture_id: string;
    furniture_name: string;
    price_cents: number;
    dimensions: {
        width: number;
        depth: number;
        height: number;
    };
}

interface CartItem {
    id: string;
    name: string;
    vendor: string;
    price_cents: number;
    quantity: number;
    sku: string;
    image_url?: string;
    product_url?: string;
    stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
    lead_time_days: number;
    dimensions: {
        width: number;
        depth: number;
        height: number;
    };
    alternatives?: Alternative[];
}

interface Alternative {
    id: string;
    name: string;
    vendor: string;
    price_cents: number;
    similarity_score: number;
    stock_status: string;
    product_url: string;
}

export function ShoppingCart({ layout, onUpdateCart }: ShoppingCartProps) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAlternatives, setShowAlternatives] = useState<string | null>(null);

    useEffect(() => {
        loadCartItems();
    }, [layout]);

    const loadCartItems = async () => {
        setIsLoading(true);

        // Convert layout placements to cart items
        const items: CartItem[] = layout.placements.map((placement, index) => ({
            id: placement.furniture_id,
            name: placement.furniture_name,
            vendor: getVendorFromId(placement.furniture_id),
            price_cents: placement.price_cents,
            quantity: 1,
            sku: placement.furniture_id,
            image_url: `/images/furniture/${placement.furniture_id}.jpg`,
            product_url: getProductUrl(placement.furniture_id),
            stock_status: getStockStatus(placement.furniture_id),
            lead_time_days: getLeadTime(placement.furniture_id),
            dimensions: placement.dimensions,
            alternatives: await getAlternatives(placement.furniture_id)
        }));

        setCartItems(items);
        setIsLoading(false);
        onUpdateCart?.(items);
    };

    const getVendorFromId = (id: string): string => {
        if (id.startsWith('90') || id.startsWith('70')) return 'IKEA';
        if (id.startsWith('W0')) return 'Wayfair';
        return 'Unknown';
    };

    const getProductUrl = (id: string): string => {
        const vendor = getVendorFromId(id);
        if (vendor === 'IKEA') {
            return `https://www.ikea.com/us/en/p/${id}/`;
        } else if (vendor === 'Wayfair') {
            return `https://www.wayfair.com/furniture/pdp/${id}.html`;
        }
        return '#';
    };

    const getStockStatus = (id: string): 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued' => {
        // Mock stock status based on ID
        const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const statuses: ('in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued')[] = ['in_stock', 'in_stock', 'in_stock', 'low_stock', 'out_of_stock'];
        return statuses[hash % statuses.length];
    };

    const getLeadTime = (id: string): number => {
        // Mock lead time based on vendor and stock
        const vendor = getVendorFromId(id);
        const stock = getStockStatus(id);

        if (stock === 'out_of_stock') return 30;
        if (stock === 'low_stock') return 14;
        if (vendor === 'IKEA') return 7;
        if (vendor === 'Wayfair') return 14;
        return 10;
    };

    const getAlternatives = async (id: string): Promise<Alternative[]> => {
        // Mock alternatives
        return [
            {
                id: `alt_${id}_1`,
                name: `Similar ${getVendorFromId(id)} Option`,
                vendor: getVendorFromId(id),
                price_cents: Math.round(Math.random() * 50000 + 20000),
                similarity_score: 0.85,
                stock_status: 'in_stock',
                product_url: getProductUrl(`alt_${id}_1`)
            },
            {
                id: `alt_${id}_2`,
                name: `Budget Alternative`,
                vendor: 'Wayfair',
                price_cents: Math.round(Math.random() * 30000 + 15000),
                similarity_score: 0.72,
                stock_status: 'in_stock',
                product_url: getProductUrl(`alt_${id}_2`)
            }
        ];
    };

    const updateQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) {
            removeItem(itemId);
            return;
        }

        const updatedItems = cartItems.map(item =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item
        );
        setCartItems(updatedItems);
        onUpdateCart?.(updatedItems);
    };

    const removeItem = (itemId: string) => {
        const updatedItems = cartItems.filter(item => item.id !== itemId);
        setCartItems(updatedItems);
        onUpdateCart?.(updatedItems);
    };

    const replaceWithAlternative = (itemId: string, alternative: Alternative) => {
        const updatedItems = cartItems.map(item =>
            item.id === itemId ? {
                ...item,
                id: alternative.id,
                name: alternative.name,
                vendor: alternative.vendor,
                price_cents: alternative.price_cents,
                sku: alternative.id,
                product_url: alternative.product_url,
                stock_status: alternative.stock_status as any
            } : item
        );
        setCartItems(updatedItems);
        setShowAlternatives(null);
        onUpdateCart?.(updatedItems);
    };

    const getTotalCost = () => {
        return cartItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    };

    const getTotalItems = () => {
        return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    };

    const getMaxLeadTime = () => {
        return Math.max(...cartItems.map(item => item.lead_time_days));
    };

    const getStockStatusColor = (status: string) => {
        switch (status) {
            case 'in_stock': return 'text-green-600 bg-green-100';
            case 'low_stock': return 'text-yellow-600 bg-yellow-100';
            case 'out_of_stock': return 'text-red-600 bg-red-100';
            case 'discontinued': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const formatLeadTime = (days: number) => {
        if (days <= 7) return `${days} days`;
        if (days <= 30) return `${Math.ceil(days / 7)} weeks`;
        return `${Math.ceil(days / 30)} months`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Loading Shopping Cart...
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse">
                                <div className="h-20 bg-gray-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Cart Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Shopping Cart - {layout.name}
                            </CardTitle>
                            <CardDescription>
                                {getTotalItems()} items • Estimated delivery: {formatLeadTime(getMaxLeadTime())}
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">{formatPrice(getTotalCost())}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Cart Items */}
            <div className="space-y-4">
                {cartItems.map((item) => (
                    <Card key={item.id}>
                        <CardContent className="p-6">
                            <div className="flex gap-4">
                                {/* Product Image */}
                                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                    <Package className="h-8 w-8 text-gray-400" />
                                </div>

                                {/* Product Details */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg">{item.name}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {item.vendor} • SKU: {item.sku}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.dimensions.width}×{item.dimensions.depth}×{item.dimensions.height}cm
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold">{formatPrice(item.price_cents)}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">each</div>
                                        </div>
                                    </div>

                                    {/* Stock Status */}
                                    <div className="flex items-center gap-2">
                                        <Badge className={`${getStockStatusColor(item.stock_status)} border-0`}>
                                            {item.stock_status === 'in_stock' && <CheckCircle className="mr-1 h-3 w-3" />}
                                            {item.stock_status === 'low_stock' && <AlertTriangle className="mr-1 h-3 w-3" />}
                                            {item.stock_status === 'out_of_stock' && <Clock className="mr-1 h-3 w-3" />}
                                            {item.stock_status.replace('_', ' ')}
                                        </Badge>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            <Truck className="inline mr-1 h-3 w-3" />
                                            {formatLeadTime(item.lead_time_days)} delivery
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            {/* Remove Button */}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Alternatives */}
                                            {item.alternatives && item.alternatives.length > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setShowAlternatives(
                                                        showAlternatives === item.id ? null : item.id
                                                    )}
                                                >
                                                    Alternatives
                                                </Button>
                                            )}

                                            {/* Wishlist */}
                                            <Button size="sm" variant="ghost">
                                                <Heart className="h-4 w-4" />
                                            </Button>

                                            {/* View Product */}
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={item.product_url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    View
                                                </a>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Alternatives Panel */}
                                    {showAlternatives === item.id && item.alternatives && (
                                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <h4 className="font-medium mb-3">Similar Options</h4>
                                            <div className="space-y-3">
                                                {item.alternatives.map((alt) => (
                                                    <div key={alt.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded border">
                                                        <div>
                                                            <h5 className="font-medium">{alt.name}</h5>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                {alt.vendor} • {Math.round(alt.similarity_score * 100)}% similar
                                                            </p>
                                                            <p className="text-lg font-bold">{formatPrice(alt.price_cents)}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" asChild>
                                                                <a href={alt.product_url} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => replaceWithAlternative(item.id, alt)}
                                                            >
                                                                Replace
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Cart Summary */}
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-lg">
                            <span>Subtotal ({getTotalItems()} items):</span>
                            <span className="font-bold">{formatPrice(getTotalCost())}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Estimated shipping:</span>
                            <span>FREE</span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Estimated tax:</span>
                            <span>{formatPrice(Math.round(getTotalCost() * 0.08))}</span>
                        </div>

                        <hr />

                        <div className="flex items-center justify-between text-xl font-bold">
                            <span>Total:</span>
                            <span>{formatPrice(getTotalCost() + Math.round(getTotalCost() * 0.08))}</span>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button className="flex-1" size="lg">
                                <CreditCard className="mr-2 h-4 w-4" />
                                Checkout
                            </Button>
                            <Button variant="outline" size="lg">
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Cart
                            </Button>
                        </div>

                        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="inline mr-1 h-3 w-3" />
                            Estimated delivery: {formatLeadTime(getMaxLeadTime())}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
