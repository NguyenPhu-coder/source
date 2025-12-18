import React from 'react';
import Layout from '@/components/Layout';
import { AIEnhancedDashboard } from './AIEnhancedDashboard';
import { useAuth } from '@/contexts/AuthContext';

const AIDashboardPage = () => {
    const { user } = useAuth();

    return (
        <Layout>
            <div className="pt-20 min-h-screen bg-background">
                <AIEnhancedDashboard
                    userId={user?.id}
                    userRole={user?.role || 'student'}
                />
            </div>
        </Layout>
    );
};

export default AIDashboardPage;
