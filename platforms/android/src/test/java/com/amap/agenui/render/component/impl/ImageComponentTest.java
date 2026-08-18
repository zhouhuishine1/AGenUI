package com.amap.agenui.render.component.impl;

import static org.junit.Assert.assertEquals;

import android.widget.ImageView;

import org.junit.Test;

public class ImageComponentTest {

    @Test
    public void parseFitMatchesA2uiImageContract() {
        assertEquals(ImageView.ScaleType.FIT_XY, ImageComponent.parseFit("fill"));
        assertEquals(ImageView.ScaleType.FIT_CENTER, ImageComponent.parseFit("contain"));
        assertEquals(ImageView.ScaleType.CENTER_CROP, ImageComponent.parseFit("cover"));
        assertEquals(ImageView.ScaleType.CENTER, ImageComponent.parseFit("none"));
        assertEquals(ImageView.ScaleType.CENTER_INSIDE, ImageComponent.parseFit("scaleDown"));
        assertEquals(ImageView.ScaleType.FIT_XY, ImageComponent.parseFit("unexpected"));
    }
}
