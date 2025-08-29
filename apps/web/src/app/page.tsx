import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Layout, Palette, ShoppingCart } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-16">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
                        AI Interior Designer
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
                        Scan any room and get instant, shoppable layouts and moodboards —
                        accurate to the centimeter, overlaid in AR with citations to real products.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Button size="lg" className="px-8" asChild>
                            <a href="/scan">Start Scanning</a>
                        </Button>
                        <Button variant="outline" size="lg" className="px-8">
                            View Demo
                        </Button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                    <Card>
                        <CardHeader>
                            <Camera className="h-8 w-8 text-blue-600 mb-2" />
                            <CardTitle>Room Scanning</CardTitle>
                            <CardDescription>
                                Use your phone to scan any room and create accurate 3D floor plans
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Layout className="h-8 w-8 text-green-600 mb-2" />
                            <CardTitle>Smart Layouts</CardTitle>
                            <CardDescription>
                                Get 3+ layout variants with proper clearances and flow optimization
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Palette className="h-8 w-8 text-purple-600 mb-2" />
                            <CardTitle>Moodboards</CardTitle>
                            <CardDescription>
                                AI-generated color palettes and furniture suggestions for your style
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <ShoppingCart className="h-8 w-8 text-orange-600 mb-2" />
                            <CardTitle>Shop & Export</CardTitle>
                            <CardDescription>
                                Get shoppable product links and export layouts as PDFs or AR files
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>

                {/* CTA Section */}
                <div className="text-center">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-2xl">Ready to Transform Your Space?</CardTitle>
                            <CardDescription className="text-lg">
                                Join our private alpha and be among the first to experience AI-powered interior design.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button size="lg" className="w-full">
                                Get Early Access
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
