/* global module, require */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * iOS: UIScene hayot sikli (Expo SDK 54 uchun config plugin).
 *
 * ⚠️ NEGA KERAK: iOS 27 SDK (Xcode 27) bilan qurilgan ilova UIScene hayot
 * siklini qo'llamasa, iOS 27 uni ISHGA TUSHISHDAYOQ o'ldiradi:
 *
 *   Application failed to launch: UIScene life cycle is required for apps
 *   built with this SDK.   →   SIGTRAP
 *
 * App Store 1.0 (61) ni 2026-11-11 da aynan shu sabab qaytardi (Guideline
 * 2.1(a), iPhone 17 Pro Max, iOS 27.0.1). Build lokal Xcode 27 da yig'ilgan
 * edi; iOS 26.x da bu tekshiruv yo'q, shuning uchun simulyatorda va o'z
 * telefonimizda ilova muammosiz ochilardi.
 *
 * Expo buni faqat SDK 57.0.23+ (`ios.enableSceneSupport`) va SDK 58 da hal
 * qilgan, SDK 54 ga ko'chirilmagan (expo/expo#46664). Bu plugin o'sha
 * yechimning SDK 54 ga moslangan ko'rinishi:
 *
 *   1. `Info.plist` ga `UIApplicationSceneManifest` qo'shadi;
 *   2. `AppDelegate.swift` da oyna yaratish va `startReactNative` ni
 *      `didFinishLaunching` dan olib tashlaydi;
 *   3. shu faylga `SceneDelegate` ni qo'shadi — u oynani sahnadan yasaydi,
 *      React Native'ni ishga tushiradi va sahna hodisalarini AppDelegate'ga
 *      qayta uzatadi (expo-linking, expo-router va boshqa
 *      `ExpoAppDelegateSubscriber` lar eskicha ishlayveradi).
 *
 * `SceneDelegate` ataylab alohida faylga EMAS, `AppDelegate.swift` ichiga
 * yoziladi: yangi faylni Xcode loyihasiga (`project.pbxproj`) qo'shish
 * kerak bo'lmaydi.
 *
 * ⚠️ `ios/` papkasi git'da yo'q (prebuild chiqishi). Lokal `ios/` ga xuddi
 * shu o'zgarish qo'lda kiritilgan; `expo prebuild` va EAS Build uni shu
 * plugin orqali oladi.
 *
 * QACHON OLIB TASHLANADI: Expo SDK 57.0.23+ ga o'tilganda (u yerda rasmiy
 * `enableSceneSupport` bor) yoki SDK 58+ da (sukut bo'yicha yoqilgan).
 * O'shanda bu plugin shablonni tanimaydi va prebuild'ni «plugin'ni olib
 * tashlang» degan xato bilan to'xtatadi — jimgina yarim qo'llanib qolmaydi.
 */

const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const TAG = 'withIosSceneLifecycle';

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

/** SDK 54 shablonidagi `var reactNativeFactory` qatori — holat shundan keyin qo'shiladi. */
const FACTORY_PROPERTY = /^( *)var reactNativeFactory: RCTReactNativeFactory\?\n/m;

/** SDK 54 shablonida oyna yaratib, React Native'ni ishga tushiradigan blok. */
const LAUNCH_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\n *window = UIWindow\(frame: UIScreen\.main\.bounds\)\n *factory\.startReactNative\(\n *withModuleName: "main",\n *in: window,\n *launchOptions: launchOptions\)\n#endif\n/;

const STATE_PROPERTIES = `
  // UIScene: React Native'ni \`SceneDelegate\` ishga tushiradi (fayl oxirida).
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  var isReactNativeStarted = false
  var detachedRootViewController: UIViewController?
`;

const LAUNCH_REPLACEMENT = `    // UIScene: oyna va React Native \`SceneDelegate\` da ishga tushadi (fayl oxirida).
    self.launchOptions = launchOptions
`;

const SCENE_DELEGATE = `
// MARK: - UIScene hayot sikli

/**
 * Oynani sahnadan (UIScene) yasaydi va React Native'ni shu yerda ishga tushiradi.
 *
 * ⚠️ NEGA KERAK: iOS 27 SDK (Xcode 27) bilan qurilgan ilova UIScene hayot
 * siklini qo'llamasa, iOS 27 uni ISHGA TUSHISHDAYOQ o'ldiradi («UIScene life
 * cycle is required for apps built with this SDK», SIGTRAP). App Store
 * 1.0 (61) ni 2026-11-11 da shu sabab qaytardi.
 *
 * ⚠️ BU KOD \`plugins/withIosSceneLifecycle.js\` DAN YOZILADI. \`ios/\` git'da
 * yo'q — o'zgartirish kerak bo'lsa o'sha faylni ham tahrirlang, aks holda
 * keyingi \`expo prebuild\` uni qaytarib yuboradi.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // expo-updates oynani \`UIApplication.shared.delegate.window\` orqali ham
    // qidiradi va topa olmasa \`fatalError\` beradi.
    appDelegate.window = window

    if appDelegate.isReactNativeStarted {
      // Sahna shu jarayon ichida QAYTA ulandi (tizim uni fonda uzgan edi).
      // ⚠️ React Native'ni ikkinchi marta ishga tushirib bo'lmaydi: expo-updates
      // \`AppController.start()\` ni jarayonda bir martagina chaqirishga ruxsat
      // beradi, ikkinchisida ilova yiqiladi. Mavjud ildiz qayta ulanadi.
      window.rootViewController = appDelegate.detachedRootViewController
      appDelegate.detachedRootViewController = nil
      window.makeKeyAndVisible()
    } else {
      appDelegate.isReactNativeStarted = true
      appDelegate.reactNativeFactory?.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: launchOptions(appDelegate.launchOptions, with: connectionOptions))
    }

    // Ilovani ochgan havola va faoliyatlar. Eski hayot siklida tizim ularni
    // \`didFinishLaunching\` dan keyin AppDelegate'ga berardi — expo-router
    // boshlang'ich marshrutni aynan shundan oladi.
    connectionOptions.urlContexts.forEach(forwardOpenURL)
    connectionOptions.userActivities.forEach(forwardUserActivity)
    if let shortcutItem = connectionOptions.shortcutItem {
      appDelegate.application(UIApplication.shared, performActionFor: shortcutItem) { _ in }
    }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    // Jarayon tirik qolishi va sahna keyinroq qayta ulanishi mumkin —
    // React Native ildizini yo'qotmaymiz (yuqoriga qarang).
    if let appDelegate, appDelegate.isReactNativeStarted {
      appDelegate.detachedRootViewController = window?.rootViewController
      if appDelegate.window === window {
        appDelegate.window = nil
      }
    }
    window?.rootViewController = nil
    window = nil
  }

  // MARK: Holat o'zgarishlari
  //
  // Sahna hayot siklida tizim AppDelegate'ning \`applicationDidBecomeActive\`
  // kabi metodlarini CHAQIRMAYDI. Expo modullari ularga obuna bo'lishi mumkin,
  // shuning uchun qo'lda uzatiladi.

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  // MARK: Havolalar va faoliyatlar

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    URLContexts.forEach(forwardOpenURL)
  }

  func scene(_ scene: UIScene, willContinueUserActivityWithType userActivityType: String) {
    _ = appDelegate?.application(
      UIApplication.shared, willContinueUserActivityWithType: userActivityType)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    forwardUserActivity(userActivity)
  }

  func scene(
    _ scene: UIScene,
    didFailToContinueUserActivityWithType userActivityType: String,
    error: Error
  ) {
    appDelegate?.application(
      UIApplication.shared, didFailToContinueUserActivityWithType: userActivityType, error: error)
  }

  func scene(_ scene: UIScene, didUpdate userActivity: NSUserActivity) {
    appDelegate?.application(UIApplication.shared, didUpdate: userActivity)
  }

  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let appDelegate else {
      completionHandler(false)
      return
    }
    appDelegate.application(
      UIApplication.shared, performActionFor: shortcutItem, completionHandler: completionHandler)
  }

  // MARK: Ichki

  private func forwardOpenURL(_ context: UIOpenURLContext) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace
    ]
    if let sourceApplication = context.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
  }

  private func forwardUserActivity(_ userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  /// React Native'ning \`Linking.getInitialURL()\` i faqat launch options'dagi shu
  /// kalitlarni o'qiydi; sahna hayot siklida ular \`didFinishLaunching\` ga emas,
  /// \`connectionOptions\` ga keladi.
  private func launchOptions(
    _ base: [UIApplication.LaunchOptionsKey: Any]?,
    with connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options = base ?? [:]

    if let url = connectionOptions.urlContexts.first?.url {
      options[.url] = url
    }
    if let userActivity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ] as [String: Any]
    }

    return options.isEmpty ? nil : options
  }
}
`;

/**
 * SDK 54 shablonidagi `AppDelegate.swift` ni sahna hayot sikliga o'tkazadi.
 *
 * Sof funksiya — fayl tizimiga tegmaydi, shuning uchun alohida testlanadi.
 *
 * @param {string} source `AppDelegate.swift` matni
 * @returns {{ contents: string, status: 'applied' | 'already-applied' | 'unsupported' }}
 */
function addSceneLifecycleToAppDelegate(source) {
  // Qayta prebuild — o'zgarish allaqachon kiritilgan
  if (source.includes('class SceneDelegate')) {
    return { contents: source, status: 'already-applied' };
  }

  // Shablon o'zgargan (masalan SDK 58: u yerda `startReactNative` AppDelegate'da
  // yo'q). Ko'r-ko'rona tahrirlab, ilovani buzib qo'ygandan ko'ra tegmaymiz.
  if (!LAUNCH_BLOCK.test(source) || !FACTORY_PROPERTY.test(source)) {
    return { contents: source, status: 'unsupported' };
  }

  const contents =
    source
      .replace(FACTORY_PROPERTY, (line) => `${line}${STATE_PROPERTIES}`)
      .replace(LAUNCH_BLOCK, LAUNCH_REPLACEMENT)
      .replace(/\n*$/, '\n') + SCENE_DELEGATE;

  return { contents, status: 'applied' };
}

/**
 * ⚠️ IKKALA MOD BIR-BIRISIZ ISHLAMAYDI. `Info.plist` da manifest bo'lib,
 * `SceneDelegate` sinfi bo'lmasa — ilova qora ekranda qoladi; aksincha
 * bo'lsa — oyna umuman yaratilmaydi. Modlar qaysi tartibda yurishi
 * kafolatlanmagan, shuning uchun biri ikkinchisining natijasiga qarab ish
 * ko'rmaydi: manifest har doim yoziladi, AppDelegate'ni o'zgartirib
 * bo'lmasa esa prebuild XATO bilan to'xtaydi. Yarim qo'llangan holat
 * (jimgina buzilgan build) yuzaga kelmaydi.
 *
 * @param {import('expo/config').ExpoConfig} config
 * @returns {import('expo/config').ExpoConfig}
 */
function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest ??= SCENE_MANIFEST;
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error(
        `[${TAG}] AppDelegate Swift'da emas (${mod.modResults.language}). UIScene hayot siklini ` +
          'qo`lda qo`shing yoki bu plugin`ni app.json dan olib tashlang.',
      );
    }

    const { contents, status } = addSceneLifecycleToAppDelegate(mod.modResults.contents);

    if (status === 'unsupported') {
      throw new Error(
        `[${TAG}] AppDelegate.swift Expo SDK 54 shabloniga o\`xshamaydi — plugin uni o\`zgartira ` +
          'olmadi. Expo SDK 57.0.23+ ga o`tgan bo`lsangiz, bu plugin`ni app.json dan olib ' +
          'tashlang: u yerda rasmiy yechim bor (SDK 57 da expo-build-properties ' +
          '`ios.enableSceneSupport`, SDK 58 da sukut bo`yicha). Aks holda plugin`dagi ' +
          'qoliplarni yangi shablonga moslang — UIScene hayot siklisiz Xcode 27 build`i ' +
          'iOS 27 da ishga tushmaydi.',
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withIosSceneLifecycle;
module.exports.addSceneLifecycleToAppDelegate = addSceneLifecycleToAppDelegate;
module.exports.SCENE_MANIFEST = SCENE_MANIFEST;
