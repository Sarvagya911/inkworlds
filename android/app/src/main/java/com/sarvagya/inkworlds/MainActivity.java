package com.sarvagya.inkworlds;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final long splashStart = SystemClock.uptimeMillis();

        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        // Keep the branded splash visible briefly so the animation feels intentional
        // rather than disappearing immediately on fast devices.
        splashScreen.setKeepOnScreenCondition(
            () -> SystemClock.uptimeMillis() - splashStart < 350
        );

        splashScreen.setOnExitAnimationListener(splashView -> {
            View icon = splashView.getIconView();

            if (icon != null) {
                icon.setAlpha(1f);
                icon.setScaleX(0.82f);
                icon.setScaleY(0.82f);

                icon.animate()
                    .scaleX(1.08f)
                    .scaleY(1.08f)
                    .alpha(0f)
                    .setDuration(600)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .withEndAction(splashView::remove)
                    .start();
            } else {
                splashView.getView()
                    .animate()
                    .alpha(0f)
                    .setDuration(450)
                    .withEndAction(splashView::remove)
                    .start();
            }
        });

        super.onCreate(savedInstanceState);
    }
}
