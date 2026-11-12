import { describe, expect, it } from 'vitest';

import plugin from './withIosSceneLifecycle.js';

const { addSceneLifecycleToAppDelegate, SCENE_MANIFEST } = plugin;

/**
 * Expo SDK 54 shabloni (`expo prebuild`) yozadigan `AppDelegate.swift`.
 *
 * ⚠️ Bu nusxa shablonga MOS bo'lishi shart: plugin undagi aniq satrlarni
 * qidiradi. SDK yangilanganda shablon o'zgarsa, haqiqiy prebuild «plugin'ni
 * olib tashlang» degan xato bilan to'xtaydi — bu testni ham yangilash kerak.
 */
const SDK54_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
  }
}
`;

describe('addSceneLifecycleToAppDelegate', () => {
  const { contents, status } = addSceneLifecycleToAppDelegate(SDK54_APP_DELEGATE);

  it('SDK 54 shablonini sahna hayot sikliga o`tkazadi', () => {
    expect(status).toBe('applied');
    expect(contents).toContain('class SceneDelegate: UIResponder, UIWindowSceneDelegate');
    expect(contents).toContain('UIWindow(windowScene: windowScene)');
  });

  /*
   * ⚠️ ENG MUHIM TEKSHIRUV. Oyna `didFinishLaunching` da yaratilsa, sahna
   * hayot siklida u ko'rinmaydi; React Native ikki marta ishga tushirilsa,
   * expo-updates ilovani yiqitadi (`AppController.start()` bir martalik).
   */
  it('oynani va React Native`ni didFinishLaunching dan olib tashlaydi', () => {
    expect(contents).not.toContain('UIWindow(frame: UIScreen.main.bounds)');
    expect(contents.match(/startReactNative\(/g)).toHaveLength(1);
    expect(contents.indexOf('startReactNative(')).toBeGreaterThan(
      contents.indexOf('class SceneDelegate'),
    );
    // Launch options sahnaga yetib borishi uchun saqlab qo'yiladi
    expect(contents).toContain('self.launchOptions = launchOptions');
    expect(contents).toContain('var launchOptions: [UIApplication.LaunchOptionsKey: Any]?');
  });

  it('shablonning qolgan qismiga tegmaydi', () => {
    expect(contents).toContain('bindReactNativeFactory(factory)');
    expect(contents).toContain(
      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    );
    expect(contents).toContain('class ReactNativeDelegate: ExpoReactNativeFactoryDelegate');
  });

  it('qayta prebuild`da ikkinchi marta qo`shmaydi', () => {
    const again = addSceneLifecycleToAppDelegate(contents);

    expect(again.status).toBe('already-applied');
    expect(again.contents).toBe(contents);
  });

  it('notanish shablonga tegmaydi — plugin xato bilan to`xtashi uchun', () => {
    const sdk58 = SDK54_APP_DELEGATE.replace(/#if os\(iOS\)[\s\S]*?#endif\n/, '');
    const result = addSceneLifecycleToAppDelegate(sdk58);

    expect(result.status).toBe('unsupported');
    expect(result.contents).toBe(sdk58);
  });
});

describe('SCENE_MANIFEST', () => {
  it('Info.plist dagi sinf nomi Swift`dagi SceneDelegate ga mos', () => {
    const [configuration] =
      SCENE_MANIFEST.UISceneConfigurations.UIWindowSceneSessionRoleApplication;

    expect(configuration?.UISceneDelegateClassName).toBe('$(PRODUCT_MODULE_NAME).SceneDelegate');
    // Bitta oynali ilova — ikkinchi sahna ochilmaydi
    expect(SCENE_MANIFEST.UIApplicationSupportsMultipleScenes).toBe(false);
  });
});
