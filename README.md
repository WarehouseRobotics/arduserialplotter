# arduserialplotter README

The serial plotter extension allows to view formatted data

## How it works

Start by ensuring you have the serialplotter.ini file setup correctly!

## Example for Arduino SDK

A variation of the following will trigger a data point on the chart:

```
Serial.printf(">var1=%f;var2=%f\n", floatvar1, floatvar2);
```

Notice the preceeding ">" and the finishing "\n". These can be fine-tuned via the ini file.
