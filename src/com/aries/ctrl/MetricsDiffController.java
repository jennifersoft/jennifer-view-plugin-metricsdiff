package com.aries.ctrl;

import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.ModelAndView;

@Controller
@RequestMapping(value = { "/plugin" })
public class MetricsDiffController {
    @RequestMapping(value = { "/metricsdiff" }, method = RequestMethod.GET)
    public ModelAndView mainPage(WebRequest request)
    {
        ModelAndView modelAndView = new ModelAndView();
        ModelMap map = modelAndView.getModelMap();

        return modelAndView;
    }
}