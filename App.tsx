import React, {useEffect, useRef, useState} from 'react';

import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  BackHandler,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ToastAndroid,
  Platform,
  PermissionsAndroid,
} from 'react-native';

import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {WebView} from 'react-native-webview';

import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';

import notifee, {
  AndroidImportance,
} from '@notifee/react-native';

const WEBSITE_URL = 'https://business.misanatan.com/';
const CHANNEL_ID = 'business_updates';

export default function App() {
  // =====================================
  // 1. REFS
  // =====================================

  const webViewRef = useRef<WebView>(null);

  // =====================================
  // 2. STATES
  // =====================================

  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Deep Linking URL State
  const [webViewUrl, setWebViewUrl] = useState(WEBSITE_URL);

  const [minimumSplashTimePassed, setMinimumSplashTimePassed] =
    useState(false);

  // =====================================
  // 3. DEEP LINKING SETUP
  // =====================================

  useEffect(() => {
    // फक्त आपल्या वेबसाइटच्या HTTPS URL स्वीकारा
    const isAllowedUrl = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);

        return (
          parsedUrl.protocol === 'https:' &&
          parsedUrl.hostname.toLowerCase() ===
            'business.misanatan.com' &&
          (parsedUrl.port === '' || parsedUrl.port === '443')
        );
      } catch (error) {
        console.log('Invalid Deep Link:', error);
        return false;
      }
    };

    const handleIncomingUrl = (url: string) => {
      console.log('Incoming Deep Link:', url);

      if (isAllowedUrl(url)) {
        setHasError(false);
        setIsLoading(true);
        setWebViewUrl(url);
      } else {
        console.log('Blocked Invalid Deep Link:', url);
      }
    };

    // App बंद असताना Link वर क्लिक केल्यास
    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          handleIncomingUrl(initialUrl);
        }
      } catch (error) {
        console.log('Initial URL Error:', error);
      }
    };

    checkInitialUrl();

    // App आधीच सुरू असताना Link वर क्लिक केल्यास
    const subscription = Linking.addEventListener(
      'url',
      event => {
        handleIncomingUrl(event.url);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // =====================================
  // 4. SPLASH SCREEN TIMER
  // =====================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumSplashTimePassed(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && minimumSplashTimePassed) {
      setShowSplash(false);
    }
  }, [isLoading, minimumSplashTimePassed]);

  // =====================================
  // 5. FIREBASE + NOTIFEE SETUP
  // =====================================

  useEffect(() => {
    let isMounted = true;

    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const setupFCM = async () => {
      try {
        // Android 13+ notification permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          const permission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Notification permission denied');
            return;
          }
        }

        // Create Android Notification Channel
        const channelId = await notifee.createChannel({
          id: CHANNEL_ID,
          name: 'Business Updates',
          importance: AndroidImportance.HIGH,
          vibration: true,
        });

        console.log('Notification Channel Created:', channelId);

        // Firebase Messaging
        const messagingInstance = getMessaging();

        await registerDeviceForRemoteMessages(messagingInstance);

        // Get FCM Token
        const token = await getToken(messagingInstance);

        if (isMounted) {
          console.log('=================================');
          console.log('FCM DEVICE TOKEN:', token);
          console.log('=================================');
        }

        // Foreground Notification Listener
        unsubscribeForeground = onMessage(
          messagingInstance,
          async remoteMessage => {
            console.log('Foreground FCM Message:', remoteMessage);

            const title =
              remoteMessage.notification?.title ||
              'Misanatan Business';

            const body =
              remoteMessage.notification?.body ||
              'तुमच्यासाठी नवीन अपडेट उपलब्ध आहे.';

            // Display local notification
            await notifee.displayNotification({
              title,
              body,
              data: remoteMessage.data,
              android: {
                channelId,
                pressAction: {
                  id: 'default',
                },
              },
            });
          },
        );

        // FCM Token Refresh Listener
        unsubscribeTokenRefresh = onTokenRefresh(
          messagingInstance,
          refreshedToken => {
            console.log('FCM TOKEN REFRESHED:', refreshedToken);
          },
        );
      } catch (error) {
        console.log('FCM / NOTIFEE ERROR:', error);
      }
    };

    setupFCM();

    return () => {
      isMounted = false;
      unsubscribeForeground?.();
      unsubscribeTokenRefresh?.();
    };
  }, []);

  // =====================================
  // 6. FILE UPLOAD SUPPORT CHECK
  // =====================================

  useEffect(() => {
    let mounted = true;

    WebView.isFileUploadSupported()
      .then(supported => {
        if (mounted) {
          console.log('File Upload Supported:', supported);
        }
      })
      .catch(error => {
        console.log('File Upload Check Error:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // =====================================
  // 7. ANDROID BACK BUTTON
  // =====================================

  useEffect(() => {
    const backAction = () => {
      if (canGoBack && !hasError) {
        webViewRef.current?.goBack();
        return true;
      }

      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [canGoBack, hasError]);

  // =====================================
  // 8. EXTERNAL LINKS
  // =====================================

  const handleExternalLinks = (request: any) => {
    const url = request.url;
    const lowerUrl = url.toLowerCase();

    const externalSchemes = [
      'whatsapp:',
      'tel:',
      'mailto:',
      'sms:',
      'geo:',
      'intent:',
    ];

    const isExternal = externalSchemes.some(scheme =>
      lowerUrl.startsWith(scheme),
    );

    if (isExternal) {
      Linking.openURL(url).catch(error => {
        console.log('External Link Error:', error);

        if (Platform.OS === 'android') {
          ToastAndroid.show(
            'Unable to open this application',
            ToastAndroid.SHORT,
          );
        }
      });

      return false;
    }

    return true;
  };

  // =====================================
  // 9. RELOAD WEBSITE
  // =====================================

  const reloadWebsite = () => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  // =====================================
  // 10. MAIN RETURN
  // =====================================

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom']}>

        <StatusBar
          backgroundColor="#FFFFFF"
          barStyle="dark-content"
          translucent={false}
        />

        <View style={styles.container}>

          {/* MAIN WEBVIEW */}

          <WebView
            ref={webViewRef}

            // Deep Link मधून मिळालेली URL
            source={{uri: webViewUrl}}

            style={styles.webview}

            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}

            // FILE ACCESS
            allowFileAccess={true}
            allowingReadAccessToURL="file://"
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}

            // PULL TO REFRESH
            pullToRefreshEnabled={true}

            // DOWNLOAD MESSAGES
            downloadingMessage="Downloading file..."
            lackPermissionToDownloadMessage="Download permission required."

            // WINDOWS
            setSupportMultipleWindows={false}

            // EXTERNAL LINKS
            onShouldStartLoadWithRequest={handleExternalLinks}

            // LOADING
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}

            onLoadEnd={() => {
              setIsLoading(false);
            }}

            // NAVIGATION
            onNavigationStateChange={navState => {
              setCanGoBack(navState.canGoBack);
            }}

            // ERRORS
            onError={event => {
              console.log('WebView Error:', event.nativeEvent);
              setIsLoading(false);
              setHasError(true);
            }}

            onHttpError={event => {
              console.log(
                'HTTP Error:',
                event.nativeEvent.statusCode,
              );
            }}

            onRenderProcessGone={() => {
              setHasError(true);
              setIsLoading(false);
            }}

            // DOWNLOAD EVENT
            onFileDownload={({nativeEvent}) => {
              console.log(
                'Download URL:',
                nativeEvent.downloadUrl,
              );
            }}
          />

          {/* LOADING INDICATOR */}

          {isLoading && !showSplash && !hasError && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#F58220"
              />

              <Text style={styles.loadingText}>
                Loading...
              </Text>
            </View>
          )}

          {/* ERROR SCREEN */}

          {hasError && !showSplash && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>!</Text>

              <Text style={styles.errorTitle}>
                Unable to Load Website
              </Text>

              <Text style={styles.errorMessage}>
                Please check your internet connection
                and try again.
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={reloadWebsite}>

                <Text style={styles.retryButtonText}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SAFFRON + WHITE SPLASH SCREEN */}

          {showSplash && (
            <View style={styles.splashContainer}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('./assets/logo.png')}
                  style={styles.splashLogo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.splashTitle}>
                MISANATAN BUSINESS
              </Text>

              <View style={styles.splashDivider} />

              <Text style={styles.splashTagline}>
                व्यापाराचा विश्वास,{'\\n'}
                प्रगतीचा ध्यास
              </Text>

              <View style={styles.splashLoader}>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text style={styles.splashLoadingText}>
                  कृपया प्रतीक्षा करा...
                </Text>
              </View>

              <Text style={styles.splashFooter}>
                स्वागत आहे!
              </Text>
            </View>
          )}

        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// =====================================
// 11. STYLES
// =====================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // SPLASH SCREEN

  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 20,
    backgroundColor: '#F58220',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },

  logoContainer: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    elevation: 8,
  },

  splashLogo: {
    width: 125,
    height: 125,
  },

  splashTitle: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textAlign: 'center',
  },

  splashDivider: {
    width: 75,
    height: 3,
    backgroundColor: '#FFFFFF',
    marginTop: 17,
    marginBottom: 17,
    borderRadius: 5,
  },

  splashTagline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: '600',
  },

  splashLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 45,
    gap: 10,
  },

  splashLoadingText: {
    fontSize: 13,
    color: '#FFFFFF',
  },

  splashFooter: {
    position: 'absolute',
    bottom: 25,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // LOADING

  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#F58220',
  },

  // ERROR

  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  errorIcon: {
    width: 65,
    height: 65,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#F58220',
    color: '#F58220',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 40,
    fontWeight: 'bold',
    overflow: 'hidden',
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222222',
    marginTop: 20,
  },

  errorMessage: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },

  retryButton: {
    backgroundColor: '#F58220',
    paddingHorizontal: 35,
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 25,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});