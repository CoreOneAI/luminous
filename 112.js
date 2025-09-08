import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, User, Home, Settings, Star, TrendingUp, Clock, CreditCard, Store, Bell, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const EcommerceAIAgent = () => {
  const [currentScreen, setCurrentScreen] = useState('onboarding');
  const [user, setUser] = useState(null);
  const [connectedStores, setConnectedStores] = useState([]);
  const [shoppingHabits, setShoppingHabits] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Mock data
  const availableStores = [
    { id: 1, name: 'Amazon', logo: '🛒', connected: false, color: '#FF9500' },
    { id: 2, name: 'Target', logo: '🎯', connected: false, color: '#CC0000' },
    { id: 3, name: 'Walmart', logo: '🏪', connected: false, color: '#0071CE' },
    { id: 4, name: 'Costco', logo: '🏢', connected: false, color: '#E31837' },
    { id: 5, name: 'Best Buy', logo: '💻', connected: false, color: '#FFE000' }
  ];

  const mockHabits = [
    { category: 'Groceries', frequency: 'Weekly', avgSpend: '$120', lastOrder: '2 days ago' },
    { category: 'Electronics', frequency: 'Monthly', avgSpend: '$250', lastOrder: '1 week ago' },
    { category: 'Clothing', frequency: 'Bi-weekly', avgSpend: '$80', lastOrder: '5 days ago' }
  ];

  const mockRecommendations = [
    { item: 'Organic Bananas', store: 'Target', price: '$2.99', savings: '$0.50', reason: 'You buy these weekly' },
    { item: 'iPhone Charger', store: 'Best Buy', price: '$19.99', savings: '$5.00', reason: 'Price dropped 20%' },
    { item: 'Running Shoes', store: 'Amazon', price: '$89.99', savings: '$15.00', reason: 'Similar to past purchases' }
  ];

  useEffect(() => {
    if (currentScreen === 'dashboard') {
      setShoppingHabits(mockHabits);
      setRecommendations(mockRecommendations);
    }
  }, [currentScreen]);

  const completeOnboarding = (userData) => {
    setUser(userData);
    setCurrentScreen('dashboard');
  };

  const connectStore = (storeId) => {
    const store = availableStores.find(s => s.id === storeId);
    if (store && !connectedStores.find(s => s.id === storeId)) {
      setConnectedStores([...connectedStores, { ...store, connected: true }]);
    }
  };

  const OnboardingScreen = () => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      preferences: []
    });

    const steps = [
      {
        title: 'Welcome to ShopAI',
        subtitle: 'Your intelligent shopping assistant',
        content: (
          <div className="text-center">
            <div className="text-6xl mb-6">🛍️</div>
            <p className="text-gray-600 mb-8">Let's set up your personalized shopping experience</p>
            <button 
              onClick={() => setOnboardingStep(1)}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold text-lg"
            >
              Get Started
            </button>
          </div>
        )
      },
      {
        title: 'Tell us about yourself',
        subtitle: 'Basic information to personalize your experience',
        content: (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              className="w-full p-4 border rounded-xl"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <input
              type="email"
              placeholder="Email address"
              className="w-full p-4 border rounded-xl"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            <button 
              onClick={() => setOnboardingStep(2)}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold"
              disabled={!formData.name || !formData.email}
            >
              Continue
            </button>
          </div>
        )
      },
      {
        title: 'Shopping preferences',
        subtitle: 'What do you usually shop for?',
        content: (
          <div className="space-y-4">
            {['Groceries', 'Electronics', 'Clothing', 'Home & Garden', 'Health & Beauty'].map(pref => (
              <label key={pref} className="flex items-center space-x-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={formData.preferences.includes(pref)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({...formData, preferences: [...formData.preferences, pref]});
                    } else {
                      setFormData({...formData, preferences: formData.preferences.filter(p => p !== pref)});
                    }
                  }}
                />
                <span className="font-medium">{pref}</span>
              </label>
            ))}
            <button 
              onClick={() => completeOnboarding(formData)}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold mt-6"
              disabled={formData.preferences.length === 0}
            >
              Complete Setup
            </button>
          </div>
        )
      }
    ];

    return (
      <div className="min-h-screen bg-white">
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex space-x-2">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-3 h-3 rounded-full ${idx <= onboardingStep ? 'bg-blue-500' : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">{onboardingStep + 1}/{steps.length}</span>
          </div>
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">{steps[onboardingStep].title}</h1>
            <p className="text-gray-600">{steps[onboardingStep].subtitle}</p>
          </div>

          {steps[onboardingStep].content}
        </div>
      </div>
    );
  };

  const DashboardScreen = () => {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white p-6 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Hello, {user?.name || 'User'}!</h1>
              <p className="text-gray-600">Ready to shop smarter?</p>
            </div>
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={() => setCurrentScreen('stores')}
              className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center space-y-2"
            >
              <Store className="w-8 h-8 text-blue-500" />
              <span className="font-medium">My Stores</span>
              <span className="text-xs text-gray-500">{connectedStores.length} connected</span>
            </button>
            <button 
              onClick={() => setCurrentScreen('habits')}
              className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center space-y-2"
            >
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="font-medium">Shopping Habits</span>
              <span className="text-xs text-gray-500">AI Insights</span>
            </button>
          </div>

          {/* AI Recommendations */}
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">🤖 AI Recommendations</h2>
            <div className="space-y-3">
              {recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{rec.item}</h3>
                      <p className="text-sm text-gray-600">{rec.store}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{rec.price}</div>
                      <div className="text-xs text-green-600">Save {rec.savings}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{rec.reason}</p>
                  <button className="w-full bg-blue-500 text-white py-2 rounded-lg text-sm font-medium">
                    Add to Auto-Order
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl shadow-sm flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div>
                  <p className="font-medium">Order placed at Target</p>
                  <p className="text-sm text-gray-600">Groceries • $127.99</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm flex items-center space-x-3">
                <Clock className="w-6 h-6 text-orange-500" />
                <div>
                  <p className="font-medium">Price alert triggered</p>
                  <p className="text-sm text-gray-600">iPhone charger • 20% off</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StoresScreen = () => {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Connected Stores</h1>
          <p className="text-gray-600">Manage your shopping accounts</p>
        </div>

        <div className="p-6">
          {/* Connected Stores */}
          {connectedStores.length > 0 && (
            <div className="mb-6">
              <h2 className="font-bold mb-4 text-green-600">✓ Connected ({connectedStores.length})</h2>
              <div className="space-y-3">
                {connectedStores.map(store => (
                  <div key={store.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{store.logo}</div>
                      <div>
                        <h3 className="font-medium">{store.name}</h3>
                        <p className="text-sm text-green-600">Active connection</p>
                      </div>
                    </div>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Stores */}
          <div>
            <h2 className="font-bold mb-4">Available Stores</h2>
            <div className="space-y-3">
              {availableStores.filter(store => !connectedStores.find(cs => cs.id === store.id)).map(store => (
                <div key={store.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{store.logo}</div>
                    <div>
                      <h3 className="font-medium">{store.name}</h3>
                      <p className="text-sm text-gray-600">Tap to connect</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => connectStore(store.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const HabitsScreen = () => {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Shopping Habits</h1>
          <p className="text-gray-600">AI-powered insights into your shopping patterns</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Spending Overview */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="font-bold mb-4">Monthly Spending</h2>
            <div className="text-3xl font-bold text-blue-600 mb-2">$1,247</div>
            <p className="text-sm text-green-600">↓ 8% from last month</p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full">
              <div className="h-2 bg-blue-500 rounded-full" style={{width: '75%'}}></div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="font-bold mb-4">Shopping Categories</h2>
            <div className="space-y-4">
              {shoppingHabits.map((habit, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium">{habit.category}</h3>
                    <p className="text-sm text-gray-600">{habit.frequency} • {habit.avgSpend}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last order</p>
                    <p className="text-sm font-medium">{habit.lastOrder}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="font-bold mb-4">🤖 AI Insights</h2>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm"><strong>Pattern detected:</strong> You tend to shop for groceries on Sundays. Would you like me to set up automatic ordering?</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                <p className="text-sm"><strong>Savings opportunity:</strong> You could save $23/month by switching your electronics purchases to Best Buy during their sales.</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                <p className="text-sm"><strong>Stock alert:</strong> Your usual brand of coffee is running a 30% discount this week.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BottomNav = () => {
    const navItems = [
      { id: 'dashboard', icon: Home, label: 'Home' },
      { id: 'stores', icon: Store, label: 'Stores' },
      { id: 'habits', icon: TrendingUp, label: 'Insights' },
      { id: 'profile', icon: User, label: 'Profile' }
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex-1 py-3 px-4 flex flex-col items-center space-y-1 ${
                currentScreen === item.id ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const ProfileScreen = () => {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Profile Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h3 className="font-medium">{user?.name || 'User'}</h3>
                <p className="text-sm text-gray-600">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <span>Shopping Preferences</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <span>Payment Methods</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <span>Notifications</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <span>Privacy Settings</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-medium mb-3">AI Assistant Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Auto-ordering</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Price alerts</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Smart recommendations</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding':
        return <OnboardingScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'stores':
        return <StoresScreen />;
      case 'habits':
        return <HabitsScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      {renderScreen()}
      {currentScreen !== 'onboarding' && <BottomNav />}
    </div>
  );
};

export default EcommerceAIAgent;