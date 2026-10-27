package com.sarvagya.inkworlds;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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
                splashView.getView()
                    .animate()
                    .alpha(0f)
                    .setDuration(350)
                    .withEndAction(splashView::remove)
                    .start();
                return;
            }

            icon.setAlpha(0f);
            icon.setScaleX(0.72f);
            icon.setScaleY(0.72f);

            icon.animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(420)
                .setInterpolator(new OvershootInterpolator(1.15f))
                .withEndAction(() ->
                    icon.animate()
                        .scaleX(1.055f)
                        .scaleY(1.055f)
                        .setDuration(160)
                        .setInterpolator(new AccelerateDecelerateInterpolator())
                        .withEndAction(() ->
                            icon.animate()
                                .scaleX(1f)
                                .scaleY(1f)
                                .setDuration(180)
                                .setInterpolator(new AccelerateDecelerateInterpolator())
                                .withEndAction(() ->
                                    icon.animate()
                                        .alpha(0f)
                                        .setDuration(300)
                                        .setInterpolator(new AccelerateDecelerateInterpolator())
                                        .withEndAction(splashView::remove)
                                        .start()
                                )
                                .start()
                        )
                        .start()
                )
                .start();
        });

        super.onCreate(savedInstanceState);
    }
}
