import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const checkAuth = async () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");

      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser);

          // Verify token is still valid by checking with backend
          const response = await fetch("http://127.0.0.1:3000/api/auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Update user data from server (in case it changed)
              const updatedUser = {
                ...parsedUser,
                ...data.data,
                token: storedToken,
              };
              setUser(updatedUser);
              localStorage.setItem("user", JSON.stringify(updatedUser));
              console.log("✅ User restored and verified:", updatedUser);
            } else {
              throw new Error("Invalid token");
            }
          } else {
            throw new Error("Token verification failed");
          }
        } catch (error) {
          console.error("Error verifying stored user:", error);
          // Clear invalid auth data
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      console.log("🔍 Login API Response:", data);

      const responseData = data.data || data;
      console.log("🔍 Response Data:", responseData);
      console.log("🔍 User from API:", responseData.user);
      console.log("🔍 Role from API:", responseData.user?.role);

      const userData = {
        id: responseData.user.id,
        email: responseData.user.email,
        name: responseData.user.name,
        role: responseData.user.role,
        phone: responseData.user.phone || null,
        bio: responseData.user.bio || null,
        location: responseData.user.location || null,
        token: responseData.token,
      };

      console.log("💾 Saving userData:", userData);

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", responseData.token);

      console.log("✅ User saved to localStorage");
      console.log("✅ Saved user:", JSON.parse(localStorage.getItem("user")));

      // Redirect based on role
      console.log("🚀 Redirecting user with role:", userData.role);

      let redirectPath = "/";
      if (userData.role === "admin") {
        console.log("🚀 Navigating to /admin/analytics");
        redirectPath = "/admin/analytics";
      } else if (userData.role === "instructor") {
        console.log("🚀 Navigating to /instructor");
        redirectPath = "/instructor";
      } else {
        console.log("🚀 Navigating to / (home)");
      }

      // Use window.location for more reliable navigation after login
      window.location.href = redirectPath;

      return { success: true, data: userData };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch("http://127.0.0.1:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const data = await response.json();
      const responseData = data.data || data;
      const userData = {
        id: responseData.user.id,
        email: responseData.user.email,
        name: responseData.user.name,
        role: responseData.user.role, // Thêm role
        token: responseData.token,
      };

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", responseData.token);

      // Redirect based on role
      let redirectPath = "/";
      if (userData.role === "admin") {
        redirectPath = "/admin/analytics";
      } else if (userData.role === "instructor") {
        redirectPath = "/instructor";
      }

      window.location.href = redirectPath;

      return { success: true };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  };

  const googleLogin = async (credentialResponse) => {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Google login failed");
      }
      const data = await response.json();
      const responseData = data.data || data;
      const userData = {
        id: responseData.user.id,
        email: responseData.user.email,
        name: responseData.user.name,
        role: responseData.user.role,
        phone: responseData.user.phone || null,
        bio: responseData.user.bio || null,
        location: responseData.user.location || null,
        token: responseData.token,
      };
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", responseData.token);

      // Redirect based on role
      let redirectPath = "/";
      if (userData.role === "admin") {
        redirectPath = "/admin/analytics";
      } else if (userData.role === "instructor") {
        redirectPath = "/instructor";
      }

      window.location.href = redirectPath;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/");
  };

  const updateUser = (updatedData) => {
    const newUserData = { ...user, ...updatedData };
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    googleLogin,
    logout,
    updateUser,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
