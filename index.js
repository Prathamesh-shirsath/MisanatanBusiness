import {AppRegistry} from 'react-native';

import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import notifee, {
  AndroidImportance,
} from '@notifee/react-native';

import App from './App';
import {name as appName} from './app.json';

const messagingInstance = getMessaging();

// BACKGROUND NOTIFICATION HANDLER

setBackgroundMessageHandler(
  messagingInstance,
  async remoteMessage => {
    console.log('BACKGROUND MESSAGE:', remoteMessage);

    // Notification payload असल्यास Android स्वतः दाखवतो.
    // Data-only message असल्यास Notifee notification दाखवतो.

    if (!remoteMessage.notification) {
      const channelId = await notifee.createChannel({
        id: 'business_updates',
        name: 'Business Updates',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });

      await notifee.displayNotification({
        title:
          remoteMessage.data?.title?.toString() ||
          'Misanatan Business',

        body:
          remoteMessage.data?.body?.toString() ||
          'नवीन व्यवसाय अपडेट उपलब्ध आहे.',

        data: remoteMessage.data,

        android: {
          channelId,

          pressAction: {
            id: 'default',
          },
        },
      });
    }
  },
);

AppRegistry.registerComponent(appName, () => App);