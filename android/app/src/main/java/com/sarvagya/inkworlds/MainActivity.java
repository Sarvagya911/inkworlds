package com.sarvagya.inkworlds;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    private static final String FILE_EVENT = "inkworlds-native-file";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final long splashStart = SystemClock.uptimeMillis();

        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        splashScreen.setKeepOnScreenCondition(
            () -> SystemClock.uptimeMillis() - splashStart < 300
        );

        splashScreen.setOnExitAnimationListener(splashView -> {
            View icon = splashView.getIconView();

            if (icon == null) {
                splashView.getView().animate().alpha(0f).setDuration(350)
                    .withEndAction(splashView::remove).start();
                return;
            }

            icon.setAlpha(0f);
            icon.setScaleX(0.72f);
            icon.setScaleY(0.72f);

            icon.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(420)
                .setInterpolator(new OvershootInterpolator(1.15f))
                .withEndAction(() -> icon.animate().scaleX(1.055f).scaleY(1.055f).setDuration(160)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .withEndAction(() -> icon.animate().scaleX(1f).scaleY(1f).setDuration(180)
                        .setInterpolator(new AccelerateDecelerateInterpolator())
                        .withEndAction(() -> icon.animate().alpha(0f).setDuration(300)
                            .setInterpolator(new AccelerateDecelerateInterpolator())
                            .withEndAction(splashView::remove).start()).start()).start()).start();
        });

        super.onCreate(savedInstanceState);
        handleFileIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleFileIntent(intent);
    }

    private void handleFileIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;

        Uri uri = intent.getData();
        if (uri == null) return;

        String mime = intent.getType();
        if (mime == null || mime.isEmpty()) mime = getContentResolver().getType(uri);
        if (mime == null) mime = "";

        // Some providers (notably messaging apps) expose an internal name such as
        // DOC000233.pdf. Prefer the title carried by the VIEW intent when available.
        String name = intent.getStringExtra(Intent.EXTRA_TITLE);
        if (isUsableName(name)) name = ensureExtension(name, mime);
        else name = queryDisplayName(uri);
        if (!isUsableName(name)) name = nameFromUri(uri);
        if (!isUsableName(name)) name = "book";

        final String finalMime = mime;
        final String finalName = name;

        new Thread(() -> {
            try {
                File dir = new File(getCacheDir(), "incoming");
                if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
                    throw new IllegalStateException("Unable to prepare temporary file storage.");
                }

                String safeName = finalName.replaceAll("[^A-Za-z0-9._-]", "_");
                File out = new File(dir, System.currentTimeMillis() + "-" + safeName);

                try (InputStream in = getContentResolver().openInputStream(uri);
                     FileOutputStream fos = new FileOutputStream(out)) {
                    if (in == null) throw new IllegalStateException("Unable to open selected file.");
                    byte[] buffer = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buffer)) != -1) fos.write(buffer, 0, n);
                }

                dispatchFile(out, finalName, finalMime);
            } catch (Exception e) {
                dispatchError(e.getMessage() == null ? "Could not open the selected file." : e.getMessage());
            }
        }).start();
    }

    private boolean isUsableName(String name) {
        if (name == null || name.trim().isEmpty()) return false;
        String base = name.trim().replaceFirst("(?i)\\.[^.]+$", "");
        return !base.matches("(?i)(DOC|DOCUMENT)[_-]?\\d+") && !base.matches("(?i)IMG[_-]?\\d+");
    }

    private String ensureExtension(String name, String mime) {
        if (name.matches("(?i).*\\.[A-Za-z0-9]{2,5}$")) return name;
        if ("application/pdf".equals(mime)) return name + ".pdf";
        if ("application/epub+zip".equals(mime)) return name + ".epub";
        if ("text/plain".equals(mime)) return name + ".txt";
        return name;
    }

    private void dispatchFile(File file, String name, String mime) {
        dispatchWhenReady(() -> {
            String nativePath = file.getAbsolutePath();
            String js = "window.dispatchEvent(new CustomEvent('" + FILE_EVENT + "',{detail:{url:" + js(nativePath) + ",name:" + js(name) + ",type:" + js(mime) + "}}));";
            getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    private void dispatchError(String message) {
        dispatchWhenReady(() -> {
            String js = "window.dispatchEvent(new CustomEvent('" + FILE_EVENT + "',{detail:{error:" + js(message) + "}}));";
            getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    private void dispatchWhenReady(Runnable action) {
        dispatchWhenReady(action, 0);
    }

    private void dispatchWhenReady(Runnable action, int attempt) {
        mainHandler.post(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) {
                retryDispatch(action, attempt);
                return;
            }

            String url = getBridge().getWebView().getUrl();
            if (url == null || !url.contains("localhost")) {
                retryDispatch(action, attempt);
                return;
            }

            String checkReady =
                "typeof window.__inkworldsNativeReady !== 'undefined' && " +
                "window.__inkworldsNativeReady === true";

            getBridge().getWebView().evaluateJavascript(
                checkReady,
                result -> {
                    if ("true".equals(result)) {
                        action.run();
                    } else {
                        retryDispatch(action, attempt);
                    }
                }
            );
        });
    }

    private void retryDispatch(Runnable action, int attempt) {
        if (attempt < 100) {
            mainHandler.postDelayed(
                () -> dispatchWhenReady(action, attempt + 1),
                100
            );
        }
    }

    private String js(String value) {
        if (value == null) return "null";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private String queryDisplayName(Uri uri) {
        try (android.database.Cursor c = getContentResolver().query(uri, new String[]{"_display_name"}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return null;
    }

    private String nameFromUri(Uri uri) {
        String last = uri.getLastPathSegment();
        return isUsableName(last) ? last : "book";
    }
}
